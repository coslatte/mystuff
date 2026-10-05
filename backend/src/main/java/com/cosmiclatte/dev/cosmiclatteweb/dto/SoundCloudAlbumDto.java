package com.cosmiclatte.dev.cosmiclatteweb.dto;

public record SoundCloudAlbumDto(
        String id,
        String title,
        String artworkUrl,
        Integer trackCount,
        String releaseDate,
        String setType,
        String url,
        Integer embedHeight,
        String spotifyUrl
) {

    /**
     * A SoundCloud record carrying the Spotify release it matches, so the UI gets
     * both platforms in one response.
     */
    public SoundCloudAlbumDto withSpotifyUrl(String spotifyUrl) {
        return new SoundCloudAlbumDto(
                id, title, artworkUrl, trackCount, releaseDate, setType, url, embedHeight, spotifyUrl);
    }
}
