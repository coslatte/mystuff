package com.cosmiclatte.dev.cosmiclatteweb.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateCommentRequest(
        @NotBlank String content
) {
}
