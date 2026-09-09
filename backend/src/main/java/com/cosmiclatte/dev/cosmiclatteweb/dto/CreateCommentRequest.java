package com.cosmiclatte.dev.cosmiclatteweb.dto;

public record CreateCommentRequest(
        String author,
        String content
) {
}
