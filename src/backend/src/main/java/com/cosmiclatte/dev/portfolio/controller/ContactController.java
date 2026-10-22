package com.cosmiclatte.dev.portfolio.controller;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.SchemaProperty;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.web.bind.annotation.ResponseStatus;

import com.cosmiclatte.dev.portfolio.common.ApiPaths;
import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.common.exception.ContactException;
import com.cosmiclatte.dev.portfolio.config.ContactProperties;
import com.cosmiclatte.dev.portfolio.dto.ContactAcceptedResponse;
import com.cosmiclatte.dev.portfolio.dto.ClientErrorReportRequest;
import com.cosmiclatte.dev.portfolio.dto.CreateContactMessageRequest;
import com.cosmiclatte.dev.portfolio.service.ContactDeliveryService;
import com.cosmiclatte.dev.portfolio.service.ContactService;
import com.cosmiclatte.dev.portfolio.service.ClientErrorReportService;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
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
    private final ClientErrorReportService errorReports;
    private final ContactProperties config;

    @PostMapping(ApiPaths.CONTACT_MESSAGES)
    @ApiResponse(responseCode = "202", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", schema = @Schema(implementation = ContactAcceptedResponse.class))))
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ResponseFormat<?> create(
            @Valid @RequestBody CreateContactMessageRequest body, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        if (config.trustForwardedFor()) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) ip = forwarded.split(",")[0].strip();
        }
        try {
            ContactAcceptedResponse receipt = service.accept(body, ip);
            deliveries.dispatch();
            return ResponseFormat.success(receipt);
        } catch (DataAccessException ex) {
            throw new ContactException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Contact is temporarily unavailable. Your message has not been confirmed. Please retry.");
        }
    }

    @PostMapping(ApiPaths.CLIENT_ERRORS)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reportClientError(
            @Valid @RequestBody ClientErrorReportRequest body, HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        if (config.trustForwardedFor()) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) ip = forwarded.split(",")[0].strip();
        }
        errorReports.report(body, ip);
    }

    @PostMapping(ApiPaths.CONTACT_RUNNER)
    @ApiResponse(responseCode = "200", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", schema = @Schema(implementation = Integer.class))))
    public ResponseFormat<?> process(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        String expected = "Bearer " + config.runnerToken();
        if (config.runnerToken().length() < 32 || authorization == null
                || !MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), authorization.getBytes(StandardCharsets.UTF_8))) {
            throw new ContactException(HttpStatus.UNAUTHORIZED, "Unauthorized.");
        }
        try {
            return ResponseFormat.success(deliveries.process());
        } catch (DataAccessException ex) {
            throw new ContactException(HttpStatus.SERVICE_UNAVAILABLE, "Delivery processing is temporarily unavailable.");
        }
    }
}
