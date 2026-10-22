package com.cosmiclatte.dev.portfolio.service;

import com.cosmiclatte.dev.portfolio.config.ContactProperties;
import com.cosmiclatte.dev.portfolio.repository.ContactRepository;
import com.cosmiclatte.dev.portfolio.repository.ContactRepository.Channel;
import com.cosmiclatte.dev.portfolio.repository.ContactRepository.Delivery;
import com.cosmiclatte.dev.portfolio.repository.ContactRepository.State;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@Service
@EnableScheduling
@EnableConfigurationProperties(ContactProperties.class)
public class ContactDeliveryService {
    private static final Logger log = LoggerFactory.getLogger(ContactDeliveryService.class);
    private static final long[] RETRY_SECONDS = {60, 300, 1800, 7200};
    private final ContactRepository repository;
    private final ContactProperties config;
    @Qualifier("contactRestClient")
    private final RestClient client;
    private final AsyncTaskExecutor executor;
    private volatile AccessToken cachedToken;
    private record AccessToken(String value, Instant expiresAt) { }

    public ContactDeliveryService(
            ContactRepository repository,
            ContactProperties config,
            @Qualifier("contactRestClient") RestClient client,
            @Qualifier("applicationTaskExecutor") AsyncTaskExecutor executor) {
        this.repository = repository;
        this.config = config;
        this.client = client;
        this.executor = executor;
    }

    /**
     * Claims at most five leased deliveries per invocation so the scheduled worker
     * stays inside the service's execution window and expired leases recover later.
     */
    public int process() {
        repository.cleanup();
        if (!config.processingEnabled()) return 0;
        int processed = 0;
        Instant deadline = Instant.now().plusSeconds(40);
        while (processed < 5 && Instant.now().isBefore(deadline)) {
            var jobs = repository.claim(config.emailEnabled(), config.telegramEnabled());
            if (jobs.isEmpty()) break;
            var delivery = jobs.getFirst();
            if (delivery.channel() == Channel.TELEGRAM) sendTelegram(delivery);
            else send(delivery);
            processed++;
        }
        return processed;
    }

    public void dispatch() {
        if (!config.immediateEnabled() || !config.processingEnabled()) return;
        try {
            executor.execute(this::processSafely);
        } catch (TaskRejectedException ex) {
            log.warn("Contact dispatch deferred to the durable queue.");
        }
    }

    @Scheduled(fixedDelay = 60000)
    public void scheduledProcess() {
        if (!config.scheduledEnabled()) return;
        processSafely();
    }

    private void processSafely() {
        try {
            process();
        } catch (RuntimeException ex) {
            log.error("Contact processing deferred type={}", ex.getClass().getSimpleName());
        }
    }

    /**
     * Refreshes OAuth credentials before renewing the lease. Provider failures after
     * the send boundary require review because Gmail does not accept idempotency keys.
     */
    private void send(Delivery delivery) {
        long started = System.nanoTime();
        String token;
        try {
            token = accessToken();
        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            if (status == 429 || status >= 500) retry(delivery, "oauth_http_" + status, retryAfter(ex));
            else repository.complete(delivery, State.FAILED, null, "oauth_http_" + status, 0, false);
            return;
        } catch (RestClientException ex) {
            retry(delivery, "oauth_unavailable", 0);
            return;
        }
        if (!repository.renewLease(delivery)) return;
        try {
            JsonNode response = client.post().uri(config.providerUrl())
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON).body(delivery.payload())
                    .retrieve().body(JsonNode.class);
            if (response == null || !response.path("id").isTextual()
                    || response.path("id").asText().isBlank() || response.path("id").asText().length() > 200) {
                requireReview(delivery, "invalid_provider_receipt");
            } else {
                repository.complete(delivery, State.PROVIDER_ACCEPTED, response.path("id").asText(), null, 0, false);
                log.info("Contact delivery message={} channel={} state=PROVIDER_ACCEPTED attempt={}",
                        delivery.id(), delivery.channel(), delivery.attempts());
            }
        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            if (status >= 500) {
                requireReview(delivery, "gmail_http_" + status);
            } else if (status == 401) {
                cachedToken = null;
                retry(delivery, "gmail_token_expired", 0);
            } else if (retryableRejection(ex)) {
                retry(delivery, "gmail_http_" + status, retryAfter(ex));
            } else {
                repository.complete(delivery, delivery.uncertain() ? State.REQUIRES_REVIEW : State.FAILED,
                        null, "gmail_http_" + status, 0, false);
                log.warn("Contact delivery message={} channel={} state=FAILED status={}", delivery.id(), delivery.channel(), status);
            }
        } catch (RestClientException ex) {
            requireReview(delivery, "gmail_network_or_response");
        } finally {
            log.info("Contact attempt message={} channel={} attempt={} elapsedMs={}", delivery.id(),
                    delivery.channel(), delivery.attempts(), (System.nanoTime() - started) / 1_000_000);
        }
    }

    private void sendTelegram(Delivery delivery) {
        if (!repository.renewLease(delivery)) return;
        try {
            JsonNode response = client.post()
                    .uri(config.telegramApiUrl() + "/bot" + config.telegramBotToken() + "/sendMessage")
                    .contentType(MediaType.APPLICATION_JSON).body(delivery.payload())
                    .retrieve().body(JsonNode.class);
            if (response != null && response.path("ok").asBoolean()
                    && response.path("result").path("message_id").canConvertToLong()
                    && response.path("result").path("message_id").asLong() > 0) {
                repository.complete(delivery, State.PROVIDER_ACCEPTED,
                        response.path("result").path("message_id").asText(), null, 0, false);
                log.info("Contact delivery message={} channel={} state=PROVIDER_ACCEPTED attempt={}",
                        delivery.id(), delivery.channel(), delivery.attempts());
            } else if (response != null && response.path("ok").isBoolean() && !response.path("ok").asBoolean()
                    && response.path("error_code").canConvertToInt()) {
                telegramRejected(delivery, response.path("error_code").asInt(), response);
            } else {
                requireReview(delivery, "telegram_invalid_receipt");
            }
        } catch (RestClientResponseException ex) {
            JsonNode body = null;
            try {
                body = ex.getResponseBodyAs(JsonNode.class);
            } catch (RuntimeException ignored) {
                // HTTP status still determines whether retrying can duplicate a notification.
            }
            telegramRejected(delivery, ex.getStatusCode().value(), body);
        } catch (RestClientException ex) {
            requireReview(delivery, "telegram_network_or_response");
        }
    }

    private void telegramRejected(Delivery delivery, int status, JsonNode response) {
        String code = "telegram_http_" + status;
        if (status == 429) {
            long delay = response == null ? 0 : Math.max(0,
                    Math.min(86400, response.path("parameters").path("retry_after").asLong()));
            retry(delivery, code, delay);
        } else if (status >= 400 && status < 500) {
            repository.complete(delivery, State.FAILED, null, code, 0, false);
            log.warn("Contact delivery message={} channel={} state=FAILED failure={}",
                    delivery.id(), delivery.channel(), code);
        } else {
            // sendMessage has no idempotency key, so an uncertain result needs manual review.
            requireReview(delivery, code);
        }
    }

    private synchronized String accessToken() {
        if (cachedToken != null && cachedToken.expiresAt().isAfter(Instant.now().plusSeconds(60))) return cachedToken.value();
        var body = new LinkedMultiValueMap<String, String>();
        body.add("client_id", config.gmailClientId());
        body.add("client_secret", config.gmailClientSecret());
        body.add("refresh_token", config.gmailRefreshToken());
        body.add("grant_type", "refresh_token");
        JsonNode response = client.post().uri(config.tokenUrl()).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(body).retrieve().body(JsonNode.class);
        if (response == null || !response.path("access_token").isTextual()
                || response.path("access_token").asText().isBlank() || !response.path("expires_in").canConvertToInt()
                || response.path("expires_in").asInt() < 120) {
            throw new RestClientException("Invalid OAuth token response.");
        }
        cachedToken = new AccessToken(response.path("access_token").asText(),
                Instant.now().plusSeconds(response.path("expires_in").asInt()));
        return cachedToken.value();
    }

    private boolean retryableRejection(RestClientResponseException ex) {
        if (ex.getStatusCode().value() == 429) return true;
        if (ex.getStatusCode().value() != 403) return false;
        try {
            JsonNode body = ex.getResponseBodyAs(JsonNode.class);
            if (body == null) return false;
            for (JsonNode error : body.path("error").path("errors")) {
                String reason = error.path("reason").asText();
                if (reason.equals("rateLimitExceeded") || reason.equals("userRateLimitExceeded")) return true;
            }
        } catch (RuntimeException ignored) {
            return false;
        }
        return false;
    }

    private long retryAfter(RestClientResponseException ex) {
        return retryAfterSeconds(ex.getResponseHeaders() == null ? null : ex.getResponseHeaders().getFirst("Retry-After"));
    }

    private void requireReview(Delivery delivery, String code) {
        repository.complete(delivery, State.REQUIRES_REVIEW, null, code, 0, true);
        log.warn("Contact delivery message={} channel={} state=REQUIRES_REVIEW failure={}", delivery.id(), delivery.channel(), code);
    }

    /**
     * Combines provider backoff with the local retry schedule and stops retries before
     * Gmail's authorization window expires.
     */
    private void retry(Delivery delivery, String code, long providerDelay) {
        long delay = Math.max(RETRY_SECONDS[Math.min(delivery.attempts() - 1, RETRY_SECONDS.length - 1)], providerDelay);
        boolean expired = !Instant.now().plusSeconds(delay).isBefore(delivery.firstAttempt().plus(Duration.ofHours(23)));
        State state = delivery.attempts() >= 5
                ? (delivery.uncertain() ? State.REQUIRES_REVIEW : State.FAILED)
                : (expired ? State.REQUIRES_REVIEW : State.PENDING);
        repository.complete(delivery, state, null, code, delay, false);
        log.warn("Contact delivery message={} channel={} state={} attempt={} failure={}",
                delivery.id(), delivery.channel(), state, delivery.attempts(), code);
    }

    static long retryAfterSeconds(String header) {
        if (header == null) return 0;
        try {
            return Math.max(0, Math.min(86400, Long.parseLong(header)));
        } catch (NumberFormatException ex) {
            try {
                return Math.max(0, Math.min(86400, Duration.between(Instant.now(),
                        ZonedDateTime.parse(header, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()).getSeconds()));
            } catch (RuntimeException ignored) {
                return 0;
            }
        }
    }
}
