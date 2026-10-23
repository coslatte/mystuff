package com.cosmiclatte.dev.portfolio.service;

import org.junit.jupiter.api.Test;

import com.cosmiclatte.dev.portfolio.dto.SoundCloudAlbumDto;
import com.cosmiclatte.dev.portfolio.service.SoundCloudService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SoundCloudServiceTest {

    /** No SoundCloud client id, so the service falls back to the static catalog. */
    private SoundCloudService service() {
        return new SoundCloudService("", "https://soundcloud.com/cosmiclattemusic");
    }

    @Test
    void listsSpotifyOnlyReleasesBeforeTheSoundCloudOnes() {
        List<SoundCloudAlbumDto> albums = service().listAlbums();

        assertThat(albums).extracting(SoundCloudAlbumDto::title)
                .containsExactly("enCrescendo", "m0Tion", "amb", "en futuro", "Singularity (2018 - 2020)", "discography");
    }

    @Test
    void attachesSpotifyCounterpartToSharedReleases() {
        SoundCloudAlbumDto amb = service().listAlbums().stream()
                .filter(album -> album.title().equals("amb"))
                .findFirst()
                .orElseThrow();

        assertThat(amb.url()).isNotNull();
        assertThat(amb.spotifyUrl()).isEqualTo("https://open.spotify.com/album/2oWurnyAaaX5rbyF6BtfEf");
    }

    @Test
    void leavesReleasesWithoutSpotifyCounterpartUntouched() {
        SoundCloudAlbumDto discography = service().listAlbums().stream()
                .filter(album -> album.title().equals("discography"))
                .findFirst()
                .orElseThrow();

        assertThat(discography.spotifyUrl()).isNull();
    }

    @Test
    void spotifyOnlyReleaseHasNoSoundCloudUrl() {
        SoundCloudAlbumDto encrescendo = service().listAlbums().stream()
                .filter(album -> album.title().equals("enCrescendo"))
                .findFirst()
                .orElseThrow();

        assertThat(encrescendo.url()).isNull();
        assertThat(encrescendo.spotifyUrl()).isNotNull();
    }
}
