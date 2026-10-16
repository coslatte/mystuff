package com.cosmiclatte.dev.portfolio.controller;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.SchemaProperty;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.web.bind.annotation.ResponseStatus;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.dto.HealthResponse;

@RestController
public class HealthController {

    private static final HealthResponse OK = new HealthResponse("ok", "cosmiclatteweb");

    @GetMapping({"/", "/health"})
    @ApiResponse(responseCode = "200", content = @Content(
            schema = @Schema(implementation = ResponseFormat.class),
            schemaProperties = @SchemaProperty(name = "data", schema = @Schema(implementation = HealthResponse.class))))
    public ResponseFormat<?> health() {
        // Wrapped like every other endpoint: the frontend unwraps a single
        // envelope shape, and an unwrapped map silently became `undefined`.
        return ResponseFormat.success(OK);
    }
}
