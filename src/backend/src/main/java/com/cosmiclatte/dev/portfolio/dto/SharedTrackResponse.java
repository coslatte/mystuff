package com.cosmiclatte.dev.portfolio.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "SharedTrackResponse", requiredProperties = {"token", "song"})
public record SharedTrackResponse(
        String token,
        @Schema(implementation = SongResponse.class) SongResponse song) {
}
