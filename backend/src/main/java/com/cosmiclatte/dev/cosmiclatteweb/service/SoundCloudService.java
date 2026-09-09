package com.cosmiclatte.dev.cosmiclatteweb.service;

import com.cosmiclatte.dev.cosmiclatteweb.dto.SoundCloudAlbumDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

@Service
public class SoundCloudService {

    private static final String API_BASE = "https://api-v2.soundcloud.com";

    private final RestClient restClient;
    private final String clientId;
    private final String userUrl;

    public SoundCloudService(
            @Value("${app.soundcloud.client-id:}") String clientId,
            @Value("${app.soundcloud.user-url:https://soundcloud.com/cosmiclattemusic}") String userUrl) {
        this.restClient = RestClient.builder().build();
        this.clientId = clientId;
        this.userUrl = userUrl;
    }

    public List<SoundCloudAlbumDto> listAlbums() {
        if (clientId == null || clientId.isBlank()) {
            return List.of();
        }
        Long userId = resolveUserId();
        if (userId == null) {
            return List.of();
        }
        try {
            SoundCloudPlaylistsResponse response = restClient.get()
                    .uri(API_BASE + "/users/{id}/playlists?limit=50&show_tracks=false&client_id={clientId}",
                            userId, clientId)
                    .retrieve()
                    .body(SoundCloudPlaylistsResponse.class);
            return mapAlbums(response);
        } catch (Exception ignored) {
            return List.of();
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
            albums.add(new SoundCloudAlbumDto(
                    String.valueOf(item.id()),
                    item.title(),
                    item.artwork_url(),
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
}
