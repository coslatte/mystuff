package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.common.dto.ResponseFormat;
import com.cosmiclatte.dev.cosmiclatteweb.dto.HealthResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    private static final HealthResponse OK = new HealthResponse("ok", "cosmiclatteweb");

    @GetMapping({"/", "/health"})
    public ResponseEntity<ResponseFormat<HealthResponse>> health() {
        // Wrapped like every other endpoint: the frontend unwraps a single
        // envelope shape, and an unwrapped map silently became `undefined`.
        return ResponseEntity.ok(ResponseFormat.success(OK));
    }
}
