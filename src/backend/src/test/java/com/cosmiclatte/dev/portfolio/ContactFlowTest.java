package com.cosmiclatte.dev.portfolio;

import com.cosmiclatte.dev.portfolio.config.ContactProperties;
import com.cosmiclatte.dev.portfolio.dto.CreateContactMessageRequest;
import com.cosmiclatte.dev.portfolio.mapper.ContactMapper;
import com.cosmiclatte.dev.portfolio.repository.ContactRepository;
import com.cosmiclatte.dev.portfolio.repository.ContactRepository.State;
import com.cosmiclatte.dev.portfolio.service.ContactService;
import com.cosmiclatte.dev.portfolio.service.ContactDeliveryService;
import com.cosmiclatte.dev.portfolio.controller.ContactController;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Base64;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.contact.email-enabled=true", "app.contact.gmail-client-id=test-client-id",
        "app.contact.gmail-client-secret=test-client-secret", "app.contact.gmail-refresh-token=test-refresh-token",
        "app.contact.from-email=contact@example.com", "app.contact.to-email=owner@example.com",
        "app.contact.runner-token=contact-runner-test-secret-32-characters",
        "app.contact.ip-hash-key=contact-hmac-test-secret-32-characters",
        "app.contact.processing-enabled=true",
        "app.contact.scheduled-enabled=false", "app.contact.immediate-enabled=false"
})
class ContactFlowTest {
    private static final String TEST_SCHEMA = "contact_test_" + UUID.randomUUID().toString().replace("-", "");
    private static final String TOKEN = "contact-runner-test-secret-32-characters";
    private static final AtomicInteger providerStatus = new AtomicInteger(200);
    private static final AtomicInteger tokenStatus = new AtomicInteger(200);
    private static final List<String> payloads = new CopyOnWriteArrayList<>();
    private static final List<String> keys = new CopyOnWriteArrayList<>();
    private static final HttpServer provider = startProvider();
    private final HttpClient http = HttpClient.newHttpClient();
    @Value("${local.server.port}") private int port;
    @Autowired private ObjectMapper json;
    @Autowired private ContactMapper mapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ContactRepository repository;
    @Autowired private ContactService service;
    @Autowired private ContactProperties config;
    @Autowired @Qualifier("applicationTaskExecutor") private AsyncTaskExecutor executor;
    @Autowired @Qualifier("contactRestClient") private RestClient client;

    @DynamicPropertySource
    static void providerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.flyway.schemas", () -> TEST_SCHEMA);
        registry.add("spring.flyway.default-schema", () -> TEST_SCHEMA);
        registry.add("spring.datasource.hikari.connection-init-sql", () -> "SET search_path TO " + TEST_SCHEMA);
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> TEST_SCHEMA);
        registry.add("app.contact.provider-url", () -> "http://127.0.0.1:" + provider.getAddress().getPort() + "/emails");
        registry.add("app.contact.token-url", () -> "http://127.0.0.1:" + provider.getAddress().getPort() + "/token");
    }

    private static HttpServer startProvider() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/emails", exchange -> {
                payloads.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                keys.add(exchange.getRequestHeaders().getFirst("Authorization"));
                byte[] response = "{\"id\":\"provider-test-id\"}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                if (providerStatus.get() == 429) exchange.getResponseHeaders().add("Retry-After", "600");
                exchange.sendResponseHeaders(providerStatus.get(), response.length);
                try (var output = exchange.getResponseBody()) { output.write(response); }
            });
            server.createContext("/token", exchange -> {
                exchange.getRequestBody().readAllBytes();
                byte[] response = (tokenStatus.get() == 200
                        ? "{\"access_token\":\"test-access-token\",\"expires_in\":3600}"
                        : "{\"error\":\"invalid_grant\"}").getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(tokenStatus.get(), response.length);
                try (var output = exchange.getResponseBody()) { output.write(response); }
            });
            server.start();
            return server;
        } catch (IOException ex) {
            throw new IllegalStateException(ex);
        }
    }

    @AfterAll
    static void stopProvider(@Autowired JdbcTemplate jdbc) {
        provider.stop(0);
        jdbc.execute("DROP SCHEMA " + TEST_SCHEMA + " CASCADE");
    }

    @BeforeEach
    void reset() {
        jdbc.update("DELETE FROM contact_messages");
        jdbc.update("DELETE FROM contact_rate_limits");
        payloads.clear();
        keys.clear();
        providerStatus.set(200);
        tokenStatus.set(200);
    }

    private Map<String, Object> message(UUID submission) {
        return Map.of("submissionId", submission, "name", " Álex ", "email", "alex@example.com",
                "message", "Hello Gabriel, let's discuss a project.", "website", "");
    }

    private HttpResponse<String> post(String path, Object body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body instanceof String text ? text : json.writeValueAsString(body)));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private String state() { return jdbc.queryForObject("SELECT state FROM contact_deliveries", String.class); }

    /** The running settings with the after-commit dispatch the runner-driven tests leave off. */
    private ContactProperties immediateDelivery() {
        return new ContactProperties(config.emailEnabled(), config.telegramEnabled(), config.processingEnabled(),
                config.scheduledEnabled(), true, config.gmailClientId(), config.gmailClientSecret(),
                config.gmailRefreshToken(), config.fromEmail(), config.toEmail(), config.runnerToken(),
                config.ipHashKey(), config.trustForwardedFor(), config.ipLimit(), config.dailyLimit(),
                config.providerUrl(), config.tokenUrl());
    }

    @Test
    void acceptsPersistsAndSendsAnImmutableEmailWithReplyTo() throws Exception {
        var response = post("/api/contact/messages", message(UUID.randomUUID()), null);
        assertThat(response.statusCode()).isEqualTo(202);
        JsonNode receipt = json.readTree(response.body()).path("data");
        assertThat(receipt.path("status").asText()).isEqualTo("accepted");
        assertThat(state()).isEqualTo("PENDING");
        assertThat(payloads).isEmpty();
        assertThat(post("/api/internal/contact/deliveries/process", "", TOKEN).statusCode()).isEqualTo(200);
        assertThat(state()).isEqualTo("PROVIDER_ACCEPTED");
        assertThat(payloads).hasSize(1);
        JsonNode mail = json.readTree(payloads.getFirst());
        String mime = new String(Base64.getUrlDecoder().decode(mail.path("raw").asText()), StandardCharsets.US_ASCII);
        assertThat(mime).contains("Reply-To: alex@example.com\r\n", "From: contact@example.com\r\n",
                "To: owner@example.com\r\n", "Message-ID: <contact." + receipt.path("messageId").asText());
        String content = new String(Base64.getMimeDecoder().decode(mime.split("\r\n\r\n", 2)[1]), StandardCharsets.UTF_8);
        assertThat(content).contains("Name: Álex", "let's discuss a project.");
        assertThat(keys.getFirst()).isEqualTo("Bearer test-access-token");
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(payloads).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contact_deliveries WHERE channel='TELEGRAM'", Integer.class)).isZero();
    }

    @Test
    void concurrentSubmissionsShareOneReceiptAndQuota() throws Exception {
        UUID id = UUID.randomUUID();
        try (var pool = Executors.newFixedThreadPool(4)) {
            var tasks = List.of(pool.submit(() -> post("/api/contact/messages", message(id), null)),
                    pool.submit(() -> post("/api/contact/messages", message(id), null)),
                    pool.submit(() -> post("/api/contact/messages", message(id), null)));
            String first = tasks.getFirst().get().body();
            for (var task : tasks) {
                var response = task.get();
                assertThat(response.statusCode()).isEqualTo(202);
                assertThat(response.body()).isEqualTo(first);
            }
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contact_messages", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count FROM contact_rate_limits WHERE scope='global'", Integer.class)).isEqualTo(1);
        var changed = Map.of("submissionId", id, "name", "Other", "email", "alex@example.com", "message", "Different message content.");
        assertThat(post("/api/contact/messages", changed, null).statusCode()).isEqualTo(409);
    }

    @Test
    void controllerDispatchesAfterCommitWithoutAnExternalRunner() {
        var sender = new ContactDeliveryService(repository, immediateDelivery(), client, executor);
        var controller = new ContactController(service, sender, immediateDelivery());
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        var receipt = controller.create(new CreateContactMessageRequest(UUID.randomUUID(), "Immediate",
                "immediate@example.com", "Send this without a scheduler invocation.", ""), request);
        assertThat(receipt.getStatusCode().value()).isEqualTo(202);
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> assertThat(state()).isEqualTo("PROVIDER_ACCEPTED"));
        assertThat(payloads).hasSize(1);
    }

    @Test
    void ambiguousGmailFailureNeverAutomaticallyResends() throws Exception {
        post("/api/contact/messages", message(UUID.randomUUID()), null);
        providerStatus.set(503);
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(state()).isEqualTo("REQUIRES_REVIEW");
        assertThat(jdbc.queryForObject("SELECT outcome_uncertain FROM contact_deliveries", Boolean.class)).isTrue();
        providerStatus.set(200);
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(payloads).hasSize(1);
    }

    @Test
    void oauthFailureBeforeSendingIsSafeToRetry() throws Exception {
        post("/api/contact/messages", message(UUID.randomUUID()), null);
        var sender = new ContactDeliveryService(repository, config, client, executor);
        tokenStatus.set(503);
        sender.process();
        assertThat(state()).isEqualTo("PENDING");
        assertThat(payloads).isEmpty();
        tokenStatus.set(200);
        jdbc.update("UPDATE contact_deliveries SET next_attempt_at = NOW()");
        sender.process();
        assertThat(state()).isEqualTo("PROVIDER_ACCEPTED");
        assertThat(payloads).hasSize(1);
    }

    @Test
    void revokedGmailAuthorizationFailsWithoutSendingMail() throws Exception {
        post("/api/contact/messages", message(UUID.randomUUID()), null);
        var sender = new ContactDeliveryService(repository, config, client, executor);
        tokenStatus.set(400);
        sender.process();
        assertThat(state()).isEqualTo("FAILED");
        assertThat(payloads).isEmpty();
    }

    @Test
    void rejectsBadInputSpamOversizedBodiesAndUnauthorizedRunner() throws Exception {
        assertThat(post("/api/contact/messages", Map.of("submissionId", UUID.randomUUID(), "name", "Alex",
                "email", "bad", "message", "Too short"), null).statusCode()).isEqualTo(400);
        assertThat(post("/api/contact/messages", Map.of("submissionId", UUID.randomUUID(), "name", "Alex",
                "email", "alex@example.com", "message", "A valid message.", "website", "spam"), null).statusCode()).isEqualTo(400);
        assertThat(post("/api/contact/messages", " ".repeat(32769), null).statusCode()).isEqualTo(413);
        var chunked = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/contact/messages"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofInputStream(() -> new ByteArrayInputStream(new byte[32769]))).build();
        assertThat(http.send(chunked, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(413);
        assertThat(post("/api/internal/contact/deliveries/process", "", null).statusCode()).isEqualTo(401);
        assertThat(post("/api/internal/contact/deliveries/process", "", "incorrect").statusCode()).isEqualTo(401);
        var browser = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/internal/contact/deliveries/process"))
                .header("Origin", "http://localhost:5173").header("Authorization", "Bearer " + TOKEN)
                .POST(HttpRequest.BodyPublishers.noBody()).build();
        assertThat(http.send(browser, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(403);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contact_messages", Integer.class)).isZero();
    }

    @Test
    void rateLimitRollbackDoesNotConsumeGlobalQuota() throws Exception {
        for (int i = 0; i < 3; i++) assertThat(post("/api/contact/messages", message(UUID.randomUUID()), null).statusCode()).isEqualTo(202);
        var fourth = post("/api/contact/messages", message(UUID.randomUUID()), null);
        assertThat(fourth.statusCode()).isEqualTo(429);
        assertThat(fourth.headers().firstValue("Retry-After")).isPresent();
        assertThat(jdbc.queryForObject("SELECT count FROM contact_rate_limits WHERE scope='global'", Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contact_messages", Integer.class)).isEqualTo(3);
    }

    @Test
    void exhaustedDailyQuotaRejectsNewMessagesButStillReturnsExistingReceipts() throws Exception {
        UUID id = UUID.randomUUID();
        var first = post("/api/contact/messages", message(id), null);
        jdbc.update("UPDATE contact_rate_limits SET count = 50 WHERE scope = 'global'");
        assertThat(post("/api/contact/messages", message(UUID.randomUUID()), null).statusCode()).isEqualTo(429);
        assertThat(post("/api/contact/messages", message(id), null).body()).isEqualTo(first.body());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contact_messages", Integer.class)).isEqualTo(1);
    }

    @Test
    void permanentProviderFailureAndExhaustedAttemptsRemainVisible() throws Exception {
        post("/api/contact/messages", message(UUID.randomUUID()), null);
        providerStatus.set(422);
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(state()).isEqualTo("FAILED");
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(payloads).hasSize(1);
        jdbc.update("UPDATE contact_deliveries SET state='PENDING', attempts=4, next_attempt_at=NOW()");
        providerStatus.set(429);
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(state()).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("SELECT attempts FROM contact_deliveries", Integer.class)).isEqualTo(5);
    }

    @Test
    void contactTablesHaveRowSecurityWithoutPublicPolicies() {
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM pg_class WHERE relname IN
                ('contact_messages', 'contact_deliveries', 'contact_rate_limits') AND relrowsecurity
                  AND relnamespace = current_schema()::regnamespace
                """, Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM pg_policies WHERE tablename IN
                ('contact_messages', 'contact_deliveries', 'contact_rate_limits')
                  AND schemaname = current_schema()
                """, Integer.class)).isZero();
    }

    @Test
    void definiteRateLimitRejectionRetriesTheSameMimeMessage() throws Exception {
        post("/api/contact/messages", message(UUID.randomUUID()), null);
        providerStatus.set(429);
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(state()).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT outcome_uncertain FROM contact_deliveries", Boolean.class)).isFalse();
        jdbc.update("UPDATE contact_deliveries SET next_attempt_at = NOW() - INTERVAL '1 minute'");
        providerStatus.set(200);
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(state()).isEqualTo("PROVIDER_ACCEPTED");
        assertThat(payloads).hasSize(2);
        assertThat(payloads.get(0)).isEqualTo(payloads.get(1));
        assertThat(keys.get(0)).isEqualTo(keys.get(1));
    }

    @Test
    void providerRetryAfterAndRetryAgeBudgetAreRespected() throws Exception {
        post("/api/contact/messages", message(UUID.randomUUID()), null);
        providerStatus.set(429);
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(state()).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT next_attempt_at > NOW() + INTERVAL '9 minutes' FROM contact_deliveries", Boolean.class)).isTrue();
        jdbc.update("UPDATE contact_deliveries SET first_attempt_at = NOW() - INTERVAL '24 hours', next_attempt_at = NOW()");
        post("/api/internal/contact/deliveries/process", "", TOKEN);
        assertThat(state()).isEqualTo("REQUIRES_REVIEW");
        assertThat(payloads).hasSize(1);
    }

    @Test
    void interruptedGmailSendRequiresReviewAndStaleRunnerCannotOverwriteIt() throws Exception {
        post("/api/contact/messages", message(UUID.randomUUID()), null);
        var original = repository.claim().getFirst();
        assertThat(repository.renewLease(original)).isTrue();
        assertThat(repository.claim()).isEmpty();
        jdbc.update("UPDATE contact_deliveries SET lease_expires_at = NOW() - INTERVAL '1 minute'");
        assertThat(repository.renewLease(original)).isFalse();
        assertThat(repository.claim()).isEmpty();
        repository.complete(original, State.FAILED, null, "stale", 0, true);
        assertThat(state()).isEqualTo("REQUIRES_REVIEW");
        assertThat(jdbc.queryForObject("SELECT failure_code FROM contact_deliveries", String.class)).isEqualTo("runner_interrupted");
    }

    @Test
    void databaseFailureRollsBackMessageAndQuota() {
        var request = new CreateContactMessageRequest(UUID.randomUUID(), "Alex", "alex@example.com", "Hello project discussion.", "");
        jdbc.execute("ALTER TABLE contact_deliveries ADD CONSTRAINT contact_test_block CHECK (channel <> 'EMAIL')");
        try {
            assertThatThrownBy(() -> service.accept(request, "127.0.0.1")).isInstanceOf(RuntimeException.class);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contact_messages", Integer.class)).isZero();
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contact_rate_limits", Integer.class)).isZero();
        } finally {
            jdbc.execute("ALTER TABLE contact_deliveries DROP CONSTRAINT contact_test_block");
        }
    }

    @Test
    void cleanupRemovesOldSuccessfulContentAndKeepsUnresolvedWork() throws Exception {
        post("/api/contact/messages", message(UUID.randomUUID()), null);
        post("/api/contact/messages", message(UUID.randomUUID()), null);
        jdbc.update("UPDATE contact_messages SET created_at = NOW() - INTERVAL '31 days'");
        jdbc.update("UPDATE contact_deliveries SET state = 'PROVIDER_ACCEPTED' WHERE message_id = (SELECT id FROM contact_messages LIMIT 1)");
        repository.cleanup();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM contact_messages", Integer.class)).isEqualTo(1);
        assertThat(state()).isEqualTo("PENDING");
    }

    @Test
    void missingConfigurationAndUnimplementedTelegramFailStartup() {
        new ApplicationContextRunner().withUserConfiguration(ContactService.class)
                .withBean(ContactRepository.class, () -> repository)
                .withBean(ObjectMapper.class, () -> json)
                .withPropertyValues("app.contact.telegram-enabled=true")
                .run(context -> assertThat(context).hasFailed());
        var disabled = new ContactProperties(false, false, true, false, false, "", "", "", "", "", "", "", false, 3, 50,
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", "https://oauth2.googleapis.com/token");
        var inactive = new ContactService(repository, disabled, json, mapper);
        assertThatThrownBy(() -> inactive.accept(new CreateContactMessageRequest(UUID.randomUUID(), "Alex",
                "alex@example.com", "Hello project discussion.", ""), "127.0.0.1"))
                .hasMessageContaining("temporarily unavailable");
        var missing = new ContactProperties(true, false, true, false, false, "", "", "", "", "", "", "", false, 3, 50,
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", "https://oauth2.googleapis.com/token");
        new ApplicationContextRunner().withBean(ContactProperties.class, () -> missing)
                .run(context -> assertThat(context).hasFailed());
    }
}
