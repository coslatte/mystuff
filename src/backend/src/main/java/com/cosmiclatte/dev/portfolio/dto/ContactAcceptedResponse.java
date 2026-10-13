package com.cosmiclatte.dev.portfolio.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ContactAcceptedResponse(@NotNull UUID messageId, @NotNull String status) {
}
