package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.dto.SoundCloudAlbumDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class SoundCloudService {

    private static final String API_BASE = "https://api-v2.soundcloud.com";
    private static final long ALBUMS_CACHE_TTL_MS = 10 * 60 * 1000L;

    private final RestClient restClient;
    private final String clientId;
    private final String userUrl;
    private volatile List<SoundCloudAlbumDto> cachedAlbums;
    private volatile long cachedAlbumsAt;

    public SoundCloudService(
            @Value("${app.soundcloud.client-id:}") String clientId,
            @Value("${app.soundcloud.user-url:https://soundcloud.com/cosmiclattemusic}") String userUrl) {
        this.restClient = RestClient.builder().build();
        this.clientId = clientId;
        this.userUrl = userUrl;
    }

    public List<SoundCloudAlbumDto> listAlbums() {
        List<SoundCloudAlbumDto> cached = cachedAlbums;
        if (cached != null && System.currentTimeMillis() - cachedAlbumsAt < ALBUMS_CACHE_TTL_MS) {
            return cached;
        }
        List<SoundCloudAlbumDto> albums = loadAlbums();
        cachedAlbums = albums;
        cachedAlbumsAt = System.currentTimeMillis();
        return albums;
    }

    private List<SoundCloudAlbumDto> loadAlbums() {
        if (clientId == null || clientId.isBlank()) {
            return staticAlbums();
        }
        Long userId = resolveUserId();
        if (userId == null) {
            return staticAlbums();
        }
        try {
            SoundCloudPlaylistsResponse response = restClient.get()
                    .uri(API_BASE + "/users/{id}/playlists?limit=50&show_tracks=false&client_id={clientId}",
                            userId, clientId)
                    .retrieve()
                    .body(SoundCloudPlaylistsResponse.class);
            List<SoundCloudAlbumDto> albums = mapAlbums(response);
            return albums.isEmpty() ? staticAlbums() : albums;
        } catch (Exception ignored) {
            return staticAlbums();
        }
    }

    /**
     * Albums published on SoundCloud, used while the SoundCloud API is not configured.
     * Artwork URLs are resolved via SoundCloud oEmbed (public, no clientId needed) and
     * hard-coded as fallback so the card always shows the cover you set on SoundCloud.
     */
    private List<SoundCloudAlbumDto> staticAlbums() {
        return List.of(
                new SoundCloudAlbumDto(
                        "amb-album",
                        "amb",
                        "https://i1.sndcdn.com/artworks-pIuJZ0yydSGTykZE-qZWmrQ-t500x500.jpg",
                        null,
                        null,
                        "album",
                        "https://soundcloud.com/cosmiclattemusic/sets/amb-album"),
                new SoundCloudAlbumDto(
                        "en-futuro-ep",
                        "en futuro",
                        "https://i1.sndcdn.com/artworks-FPmDgeKzK3zWuEP7-7jpFXg-t500x500.jpg",
                        null,
                        null,
                        "ep",
                        "https://soundcloud.com/cosmiclattemusic/sets/en-futuro-ep"),
                new SoundCloudAlbumDto(
                        "discography",
                        "discography",
                        "https://i1.sndcdn.com/artworks-rZ2E90GgJ6ld6p5p-zwmCAw-t500x500.jpg",
                        null,
                        null,
                        "compilation",
                        "https://soundcloud.com/cosmiclattemusic/sets/discography")
        );
    }

    private String fetchArtworkViaOEmbed(String permalinkUrl) {
        if (permalinkUrl == null || permalinkUrl.isBlank()) return null;
        try {
            String oEmbedUrl = "https://soundcloud.com/oembed?format=json&url="
                    + URLEncoder.encode(permalinkUrl, StandardCharsets.UTF_8);
            SoundCloudOEmbed oEmbed = restClient.get()
                    .uri(oEmbedUrl)
                    .retrieve()
                    .body(SoundCloudOEmbed.class);
            return oEmbed != null ? oEmbed.thumbnail_url() : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private Long resolveUserId() {
        try {
            SoundCloudUser user = restClient.get()
                    .uri(API_BASE + "/resolve?url={url}&client_id={clientId}", userUrl, clientId)
                    .retrieve()
                    .body(SoundCloudUser.class);
            return user != null ? user.id() : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<SoundCloudAlbumDto> mapAlbums(SoundCloudPlaylistsResponse response) {
        List<SoundCloudAlbumDto> albums = new ArrayList<>();
        if (response == null || response.collection() == null) {
            return albums;
        }
        for (SoundCloudPlaylist item : response.collection()) {
            if (item == null || !"playlist".equals(item.kind()) || item.id() == null || item.title() == null) {
                continue;
            }
            String releaseDate = item.release_date();
            if (releaseDate != null && releaseDate.length() >= 4) {
                releaseDate = releaseDate.substring(0, 4);
            }
            String artwork = item.artwork_url();
            if (artwork == null || artwork.isBlank()) {
                artwork = fetchArtworkViaOEmbed(item.permalink_url());
            }
            albums.add(new SoundCloudAlbumDto(
                    String.valueOf(item.id()),
                    item.title(),
                    artwork,
                    item.track_count() != null && item.track_count() > 0 ? item.track_count() : null,
                    releaseDate,
                    item.set_type() == null ? "album" : item.set_type(),
                    item.permalink_url()
            ));
        }
        return albums;
    }

    private record SoundCloudPlaylistsResponse(List<SoundCloudPlaylist> collection) {
    }

    private record SoundCloudPlaylist(
            String kind,
            Long id,
            String title,
            String artwork_url,
            Integer track_count,
            String release_date,
            String set_type,
            String permalink_url
    ) {
    }

    private record SoundCloudUser(Long id) {
    }

    private record SoundCloudOEmbed(String thumbnail_url) {
    }
}
