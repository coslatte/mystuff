package com.cosmiclatte.dev.portfolio.service;

import com.cosmiclatte.dev.portfolio.common.exception.ContactException;
import com.cosmiclatte.dev.portfolio.config.ContactProperties;
import com.cosmiclatte.dev.portfolio.dto.ClientErrorReportRequest;
import com.cosmiclatte.dev.portfolio.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Service
@RequiredArgsConstructor
public class ClientErrorReportService {
    private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ISO_INSTANT.withZone(ZoneOffset.UTC);
    private static final int IP_LIMIT = 5;
    private static final int DAILY_LIMIT = 50;

    private final ContactRepository repository;
    private final ContactProperties config;
    private final ContactDeliveryService deliveries;

    public void report(ClientErrorReportRequest report, String clientIp) {
        if (!config.telegramEnabled()) {
            throw new ContactException(HttpStatus.SERVICE_UNAVAILABLE, "Error reporting is unavailable.");
        }

        Instant now = Instant.now();
        Instant hour = Instant.ofEpochSecond(now.getEpochSecond() / 3600 * 3600);
        Instant day = Instant.ofEpochSecond(now.getEpochSecond() / 86400 * 86400);
        repository.consumeLimit("error:ip:" + hashIp(clientIp), hour, hour.plusSeconds(3600), IP_LIMIT);
        repository.consumeLimit("client-error:global", day, day.plusSeconds(86400), DAILY_LIMIT);
        deliveries.sendClientErrorReport(format(report, now));
    }

    private String format(ClientErrorReportRequest report, Instant occurredAt) {
        String text = "Portfolio client error\n"
                + "Time: " + TIMESTAMP.format(occurredAt) + "\n"
                + "Component: " + report.component() + "\n"
                + "Error: " + report.errorName() + ": " + report.message() + "\n"
                + "Path: " + report.path() + "\n"
                + (report.stack().isBlank() ? "" : "Stack:\n" + report.stack());
        if (text.length() <= 3900) return text;
        int end = 3890;
        if (Character.isHighSurrogate(text.charAt(end - 1))) end--;
        return text.substring(0, end) + "\n[truncated]";
    }

    private String hashIp(String ip) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(config.ipHashKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(ip.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not initialize client error rate limits.");
        }
    }
}
