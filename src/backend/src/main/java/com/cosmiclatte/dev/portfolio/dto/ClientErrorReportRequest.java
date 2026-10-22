package com.cosmiclatte.dev.portfolio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ClientErrorReportRequest(
        @NotBlank @Size(max = 80) String component,
        @NotBlank @Size(max = 100) String errorName,
        @NotBlank @Size(max = 1000) String message,
        @Size(max = 2500) String stack,
        @NotBlank @Size(max = 300) String path) {
    public ClientErrorReportRequest {
        component = component == null ? null : component.strip();
        errorName = errorName == null ? null : errorName.strip();
        message = message == null ? null : message.strip();
        stack = stack == null ? "" : stack.strip();
        path = path == null ? null : path.strip();
    }
}
