package com.cosmiclatte.dev.portfolio.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AdminAuth {

    private static final Logger log = LoggerFactory.getLogger(AdminAuth.class);

    private final String adminApiKey;

    public AdminAuth(@Value("${app.admin-api-key:changeme}") String adminApiKey) {
        this.adminApiKey = adminApiKey;
        if (adminApiKey.isBlank() || "changeme".equals(adminApiKey)) {
            log.warn("Admin access is disabled. Set ADMIN_API_KEY to a non-default secret.");
        }
    }

    public boolean isAdmin(String providedKey) {
        return !adminApiKey.isBlank() && !"changeme".equals(adminApiKey)
                && providedKey != null && providedKey.equals(adminApiKey);
    }
}
