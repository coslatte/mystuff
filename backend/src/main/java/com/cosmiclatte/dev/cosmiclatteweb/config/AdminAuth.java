package com.cosmiclatte.dev.cosmiclatteweb.config;

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
        if ("changeme".equals(adminApiKey)) {
            log.warn("ADMIN_API_KEY usa el valor por defecto 'changeme'. "
                    + "Define ADMIN_API_KEY con un secreto en producción.");
        }
    }

    public boolean isAdmin(String providedKey) {
        return providedKey != null && !providedKey.isBlank() && providedKey.equals(adminApiKey);
    }
}
