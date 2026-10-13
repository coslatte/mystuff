package com.cosmiclatte.dev.portfolio.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import jakarta.annotation.PostConstruct;

@ConfigurationProperties("app.contact")
public record ContactProperties(
        boolean emailEnabled,
        boolean telegramEnabled,
        boolean processingEnabled,
        boolean scheduledEnabled,
        boolean immediateEnabled,
        String gmailClientId,
        String gmailClientSecret,
        String gmailRefreshToken,
        String fromEmail,
        String toEmail,
        String runnerToken,
        String ipHashKey,
        boolean trustForwardedFor,
        int ipLimit,
        int dailyLimit,
        String providerUrl,
        String tokenUrl) {
    @PostConstruct
    void validate() {
        if (telegramEnabled) throw new IllegalStateException("Telegram delivery is not implemented yet.");
        if (emailEnabled && (gmailClientId.isBlank() || gmailClientSecret.isBlank() || gmailRefreshToken.isBlank()
                || runnerToken.length() < 32 || ipHashKey.length() < 32
                || !fromEmail.matches(com.cosmiclatte.dev.portfolio.dto.CreateContactMessageRequest.ADDRESS_PATTERN)
                || !toEmail.matches(com.cosmiclatte.dev.portfolio.dto.CreateContactMessageRequest.ADDRESS_PATTERN)
                || ipLimit < 1 || dailyLimit < 1)) {
            throw new IllegalStateException("Contact email requires Gmail credentials, valid addresses, positive limits, and secrets of at least 32 characters.");
        }
    }
}
