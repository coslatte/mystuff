package com.cosmiclatte.dev.cosmiclatteweb.dto;

public record SoundCloudAlbumDto(
        String id,
        String title,
        String artworkUrl,
        Integer trackCount,
        String releaseDate,
        String setType,
        String url
) {
}
