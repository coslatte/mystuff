package com.cosmiclatte.dev.portfolio;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;
import com.sun.net.httpserver.HttpServer;
import com.cosmiclatte.dev.portfolio.config.AdminAuth;
import com.cosmiclatte.dev.portfolio.service.storage.SupabaseAudioStorage;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class AppTests {

    @Test
    void contextLoads() {
    }

    @Test
    void placeholderAdminKeyDoesNotGrantAccess() {
        assertThat(new AdminAuth("changeme").isAdmin("changeme")).isFalse();
        assertThat(new AdminAuth("").isAdmin("")).isFalse();
        assertThat(new AdminAuth("test-admin-key").isAdmin("test-admin-key")).isTrue();
        assertThat(new AdminAuth("test-admin-key").isAdmin(null)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"sb_secret_test-key", "legacy.service-role.jwt"})
    void storageUsesTheCorrectAuthenticationHeaders(String key) throws Exception {
        AtomicReference<String> apiKey = new AtomicReference<>();
        AtomicReference<String> authorization = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/storage/v1/object/sign/music/test.mp3", exchange -> {
            apiKey.set(exchange.getRequestHeaders().getFirst("apikey"));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = "{\"signedURL\":\"/object/sign/music/test.mp3?token=test\"}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            SupabaseAudioStorage storage = new SupabaseAudioStorage(base, "music", key, 1024, 3600);
            assertThat(storage.signedUrl("test.mp3"))
                    .isEqualTo(base + "/storage/v1/object/sign/music/test.mp3?token=test");
            assertThat(apiKey.get()).isEqualTo(key);
            assertThat(authorization.get()).isEqualTo(key.startsWith("sb_secret_") ? null : "Bearer " + key);
        } finally {
            server.stop(0);
        }
    }

}
