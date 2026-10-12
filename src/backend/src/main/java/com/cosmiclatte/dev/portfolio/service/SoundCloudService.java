package com.cosmiclatte.dev.portfolio.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.cosmiclatte.dev.portfolio.dto.SoundCloudAlbumDto;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SoundCloudService {

    private static final String API_BASE = "https://api-v2.soundcloud.com";
    private static final long ALBUMS_CACHE_TTL_MS = 10 * 60 * 1000L;
    /** SoundCloud's default embed height for a playlist/set. */
    private static final int DEFAULT_EMBED_HEIGHT = 450;

    /**
     * Spotify counterpart of the releases that are also published as a SoundCloud
     * set, keyed by {@link #normalized(String) normalized} title so that casing and
     * punctuation differences between platforms do not break the match.
     */
    private static final Map<String, String> SPOTIFY_URL_BY_TITLE = Map.of(
            "amb", "https://open.spotify.com/album/2oWurnyAaaX5rbyF6BtfEf"
    );

    /**
     * Releases that only live on Spotify. They are listed before the SoundCloud
     * ones and carry no SoundCloud URL, so the UI can only play them from Spotify.
     */
    private static final List<SoundCloudAlbumDto> SPOTIFY_ONLY_ALBUMS = List.of(
            new SoundCloudAlbumDto(
                    "encrescendo",
                    "enCrescendo",
                    "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0262ccfd906647f3725a013e62",
                    8,
                    "2026",
                    "album",
                    null,
                    null,
                    "https://open.spotify.com/album/6axLvvECijJ2FMCw4FwFmA")
    );

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
        List<SoundCloudAlbumDto> albums = withCatalog(loadAlbums());
        cachedAlbums = albums;
        cachedAlbumsAt = System.currentTimeMillis();
        return albums;
    }

    /**
     * Merges the SoundCloud albums (live or static) with the rest of the catalog:
     * each SoundCloud album gets its Spotify counterpart attached, and the
     * Spotify-only releases are prepended. A release listed in both sources is
     * kept only once, on whichever side it shows up first.
     */
    private List<SoundCloudAlbumDto> withCatalog(List<SoundCloudAlbumDto> soundcloudAlbums) {
        Set<String> soundcloudTitles = soundcloudAlbums.stream()
                .map(SoundCloudAlbumDto::title)
                .map(SoundCloudService::normalized)
                .collect(Collectors.toSet());

        List<SoundCloudAlbumDto> catalog = new ArrayList<>();
        SPOTIFY_ONLY_ALBUMS.stream()
                .filter(release -> !soundcloudTitles.contains(normalized(release.title())))
                .forEach(catalog::add);
        soundcloudAlbums.forEach(album -> catalog.add(
                album.withSpotifyUrl(SPOTIFY_URL_BY_TITLE.get(normalized(album.title())))));
        return List.copyOf(catalog);
    }

    private static String normalized(String title) {
        return title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
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
     * Albums published on SoundCloud, used while the SoundCloud API is not
     * configured. Artwork is resolved through SoundCloud oEmbed, which is public
     * and needs no client id; these URLs are the fallback for when oEmbed is
     * unreachable.
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
                        "https://soundcloud.com/cosmiclattemusic/sets/amb-album",
                        DEFAULT_EMBED_HEIGHT,
                        null),
                new SoundCloudAlbumDto(
                        "en-futuro-ep",
                        "en futuro",
                        "https://i1.sndcdn.com/artworks-FPmDgeKzK3zWuEP7-7jpFXg-t500x500.jpg",
                        null,
                        null,
                        "ep",
                        "https://soundcloud.com/cosmiclattemusic/sets/en-futuro-ep",
                        DEFAULT_EMBED_HEIGHT,
                        null),
                new SoundCloudAlbumDto(
                        "discography",
                        "discography",
                        "https://i1.sndcdn.com/artworks-rZ2E90GgJ6ld6p5p-zwmCAw-t500x500.jpg",
                        null,
                        null,
                        "compilation",
                        "https://soundcloud.com/cosmiclattemusic/sets/discography",
                        DEFAULT_EMBED_HEIGHT,
                        null)
        );
    }

    /**
     * Resolves SoundCloud's public oEmbed payload for a resource. It carries the
     * canonical embed height (450 for sets) and a thumbnail, so the UI can size
     * the iframe to exactly what SoundCloud renders instead of guessing.
     */
    private SoundCloudOEmbed fetchOEmbed(String permalinkUrl) {
        if (permalinkUrl == null || permalinkUrl.isBlank()) return null;
        try {
            String oEmbedUrl = "https://soundcloud.com/oembed?format=json&url="
                    + URLEncoder.encode(permalinkUrl, StandardCharsets.UTF_8);
            return restClient.get()
                    .uri(oEmbedUrl)
                    .retrieve()
                    .body(SoundCloudOEmbed.class);
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
            SoundCloudOEmbed oEmbed = null;
            if (artwork == null || artwork.isBlank()) {
                oEmbed = fetchOEmbed(item.permalink_url());
                if (oEmbed != null) {
                    artwork = oEmbed.thumbnail_url();
                }
            }
            Integer embedHeight = oEmbed != null && oEmbed.height() != null
                    ? oEmbed.height()
                    : DEFAULT_EMBED_HEIGHT;
            albums.add(new SoundCloudAlbumDto(
                    String.valueOf(item.id()),
                    item.title(),
                    artwork,
                    item.track_count() != null && item.track_count() > 0 ? item.track_count() : null,
                    releaseDate,
                    item.set_type() == null ? "album" : item.set_type(),
                    item.permalink_url(),
                    embedHeight,
                    null
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

    private record SoundCloudOEmbed(String thumbnail_url, Integer height, String width) {
    }
}
