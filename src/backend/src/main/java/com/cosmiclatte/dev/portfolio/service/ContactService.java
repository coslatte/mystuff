package com.cosmiclatte.dev.portfolio.service;

import com.cosmiclatte.dev.portfolio.common.exception.ContactException;
import com.cosmiclatte.dev.portfolio.config.ContactProperties;
import com.cosmiclatte.dev.portfolio.dto.ContactAcceptedResponse;
import com.cosmiclatte.dev.portfolio.dto.CreateContactMessageRequest;
import com.cosmiclatte.dev.portfolio.mapper.ContactMapper;
import com.cosmiclatte.dev.portfolio.repository.ContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContactService {
    private final ContactRepository repository;
    private final ContactProperties config;
    private final ObjectMapper json;
    private final ContactMapper mapper;

    /**
     * Persists a rate-limited, idempotent delivery request before the asynchronous
     * sender can claim it. The stored MIME payload stays immutable across retries.
     */
    @Transactional
    public ContactAcceptedResponse accept(CreateContactMessageRequest request, String clientIp) {
        if (!config.emailEnabled()) throw new ContactException(HttpStatus.SERVICE_UNAVAILABLE,
                "Contact is temporarily unavailable. Please try again later.");
        String fingerprint = digest(json.writeValueAsString(List.of(request.name(), request.email(), request.message())));
        var receipt = repository.findAndLock(request.submissionId());
        if (receipt != null) {
            if (!receipt.fingerprint().equals(fingerprint)) throw new ContactException(HttpStatus.CONFLICT,
                    "This submission reference already belongs to another message.");
            return mapper.toAcceptedResponse(receipt.id());
        }
        Instant now = Instant.now();
        long seconds = now.getEpochSecond();
        Instant quarterHour = Instant.ofEpochSecond(seconds - seconds % 900);
        Instant day = Instant.ofEpochSecond(seconds - seconds % 86400);
        repository.consumeLimit("global", day, day.plusSeconds(86400), config.dailyLimit());
        repository.consumeLimit("ip:" + hashIp(clientIp), quarterHour, quarterHour.plusSeconds(900), config.ipLimit());
        UUID id = UUID.randomUUID();
        String payload = mapper.toGmailPayload(id, request, config.fromEmail(), config.toEmail(), now, json);
        repository.insert(id, request, fingerprint, payload);
        return mapper.toAcceptedResponse(id);
    }

    private String hashIp(String ip) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(config.ipHashKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(ip.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not initialize contact rate limits.");
        }
    }

    private static String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not create contact fingerprint.");
        }
    }
}
