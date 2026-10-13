package com.cosmiclatte.dev.portfolio.controller;

import com.cosmiclatte.dev.portfolio.common.ApiPaths;
import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.common.exception.ContactException;
import com.cosmiclatte.dev.portfolio.config.ContactProperties;
import com.cosmiclatte.dev.portfolio.dto.ContactAcceptedResponse;
import com.cosmiclatte.dev.portfolio.dto.CreateContactMessageRequest;
import com.cosmiclatte.dev.portfolio.service.ContactDeliveryService;
import com.cosmiclatte.dev.portfolio.service.ContactService;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequiredArgsConstructor
public class ContactController {
    private final ContactService service;
    private final ContactDeliveryService deliveries;
    private final ContactProperties config;

    @PostMapping(ApiPaths.CONTACT_MESSAGES)
    public ResponseEntity<ResponseFormat<ContactAcceptedResponse>> create(
            @Valid @RequestBody CreateContactMessageRequest body, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        if (config.trustForwardedFor()) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) ip = forwarded.split(",")[0].strip();
        }
        try {
            ContactAcceptedResponse receipt = service.accept(body, ip);
            deliveries.dispatch();
            return ResponseEntity.accepted().body(ResponseFormat.success(receipt));
        } catch (DataAccessException ex) {
            throw new ContactException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Contact is temporarily unavailable. Your message has not been confirmed. Please retry.");
        }
    }

    @PostMapping(ApiPaths.CONTACT_RUNNER)
    public ResponseEntity<ResponseFormat<Integer>> process(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        String expected = "Bearer " + config.runnerToken();
        if (config.runnerToken().length() < 32 || authorization == null
                || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), authorization.getBytes(StandardCharsets.UTF_8))) {
            throw new ContactException(HttpStatus.UNAUTHORIZED, "Unauthorized.");
        }
        try {
            return ResponseEntity.ok(ResponseFormat.success(deliveries.process()));
        } catch (DataAccessException ex) {
            throw new ContactException(HttpStatus.SERVICE_UNAVAILABLE, "Delivery processing is temporarily unavailable.");
        }
    }
}
