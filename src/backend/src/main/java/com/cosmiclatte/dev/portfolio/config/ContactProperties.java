package com.cosmiclatte.dev.portfolio.config;

import com.cosmiclatte.dev.portfolio.dto.CreateContactMessageRequest;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;

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
        String tokenUrl,
        String telegramBotToken,
        String telegramChatId,
        String telegramApiUrl) {
    @PostConstruct
    void validate() {
        if (telegramEnabled && (!telegramBotToken.matches("[0-9]+:[A-Za-z0-9_-]{16,}")
                || !telegramChatId.matches("-?[1-9][0-9]*"))) {
            throw new IllegalStateException("Telegram delivery requires a valid bot token and numeric chat ID.");
        }
        if ((telegramEnabled || emailEnabled) && ipHashKey.length() < 32) {
            throw new IllegalStateException("Contact rate limiting requires an IP hash key of at least 32 characters.");
        }
        if (emailEnabled && (gmailClientId.isBlank() || gmailClientSecret.isBlank() || gmailRefreshToken.isBlank()
                || runnerToken.length() < 32 || ipHashKey.length() < 32
                || !fromEmail.matches(CreateContactMessageRequest.ADDRESS_PATTERN)
                || !toEmail.matches(CreateContactMessageRequest.ADDRESS_PATTERN)
                || ipLimit < 1 || dailyLimit < 1)) {
            throw new IllegalStateException("Contact email requires Gmail credentials, valid addresses, positive limits, and secrets of at least 32 characters.");
        }
    }
}
