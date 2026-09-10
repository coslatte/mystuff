package com.cosmiclatte.dev.cosmiclatteweb.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateCommentRequest(
        @NotBlank String author,
        @NotBlank String content
) {
}
