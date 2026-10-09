package com.cosmiclatte.dev.portfolio.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * A release as the streaming providers describe it. Only id and title are always
 * present; every other field depends on what the upstream API chose to return,
 * which is why the UI guards every access to them.
 */
@Schema(name = "SoundCloudAlbumDto")
public record SoundCloudAlbumDto(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
        String artworkUrl,
        Integer trackCount,
        String releaseDate,
        String setType,
        String url,
        Integer embedHeight,
        String spotifyUrl
) {

    /**
     * A copy of this release carrying the Spotify release it matches, so the UI gets
     * both platforms in one response.
     */
    public SoundCloudAlbumDto withSpotifyUrl(String spotifyUrl) {
        return new SoundCloudAlbumDto(
                id, title, artworkUrl, trackCount, releaseDate, setType, url, embedHeight, spotifyUrl);
    }
}