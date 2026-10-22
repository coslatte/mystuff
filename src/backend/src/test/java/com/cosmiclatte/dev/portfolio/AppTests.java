package com.cosmiclatte.dev.portfolio;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.mock.web.MockMultipartFile;
import com.cosmiclatte.dev.portfolio.common.exception.BadRequestException;
import com.sun.net.httpserver.HttpServer;
import com.cosmiclatte.dev.portfolio.config.AdminAuth;
import com.cosmiclatte.dev.portfolio.mapper.SongMapper;
import com.cosmiclatte.dev.portfolio.repository.CommentRepository;
import com.cosmiclatte.dev.portfolio.repository.RatingRepository;
import com.cosmiclatte.dev.portfolio.repository.SongRepository;
import com.cosmiclatte.dev.portfolio.service.AudioMetadataService;
import com.cosmiclatte.dev.portfolio.service.SharedTrackService;
import com.cosmiclatte.dev.portfolio.service.SongService;
import com.cosmiclatte.dev.portfolio.service.storage.AudioStorage;
import com.cosmiclatte.dev.portfolio.service.storage.LocalDiskAudioStorage;
import com.cosmiclatte.dev.portfolio.service.storage.SupabaseAudioStorage;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest
class AppTests {

    @Autowired
    private PlatformTransactionManager transactionManager;

    private final SongRepository songs = mock(SongRepository.class);
    private final AudioStorage storage = mock(AudioStorage.class);
    private final MultipartFile audio = mock(MultipartFile.class);
    private final MultipartFile artwork = mock(MultipartFile.class);

    private SongService songService() {
        when(storage.store(audio)).thenReturn("new.mp3");
        when(storage.storeArtwork(artwork)).thenReturn("cover.png");
        when(songs.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        return new SongService(songs, mock(RatingRepository.class), mock(CommentRepository.class),
                storage, mock(AudioMetadataService.class), mock(SongMapper.class), mock(SharedTrackService.class));
    }

    @Test
    void failedArtworkUploadRemovesPreviouslyStoredAudio(@TempDir Path directory) {
        LocalDiskAudioStorage files = new LocalDiskAudioStorage(directory.toString(), 1024, "", 8080);
        SongService service = new SongService(songs, mock(RatingRepository.class), mock(CommentRepository.class),
                files, mock(AudioMetadataService.class), mock(SongMapper.class), mock(SharedTrackService.class));
        MultipartFile audioFile = new MockMultipartFile("file", "track.mp3", "audio/mpeg", new byte[]{1, 2, 3});
        MultipartFile invalidArtwork = new MockMultipartFile("artwork", "cover.svg", "image/svg+xml", new byte[]{1});

        assertThatThrownBy(() -> new TransactionTemplate(transactionManager).execute(status ->
                service.createSong("Track", "Artist", audioFile, invalidArtwork)))
                .isInstanceOf(BadRequestException.class);

        assertThat(directory).isEmptyDirectory();
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void newSongFilesAreRemovedOnlyOnRollback(boolean rollback) {
        SongService service = songService();

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            service.createSong("Track", "Artist", audio, artwork);
            if (rollback) status.setRollbackOnly();
        });

        verify(storage, times(rollback ? 1 : 0)).delete("new.mp3");
        verify(storage, times(rollback ? 1 : 0)).delete("cover.png");
    }

    @Test
    void contextLoads() {
    }

    @Test
    void placeholderAdminKeyDoesNotGrantAccess() {
        assertThat(new AdminAuth("changeme").isAdmin("changeme")).isFalse();
        assertThat(new AdminAuth("").isAdmin("")).isFalse();
        assertThat(new AdminAuth("test-admin-key").isAdmin("test-admin-key")).isTrue();
        assertThat(new AdminAuth("test-admin-key").isAdmin(null)).isFalse();
    }

    @Test
    void localAudioUsesSpringPortAndAllowsAnExplicitBaseUrl(@TempDir Path directory) {
        ApplicationContextRunner runner = new ApplicationContextRunner()
                .withUserConfiguration(LocalDiskAudioStorage.class)
                .withPropertyValues(
                        "app.storage.backend=local",
                        "app.storage.local.directory=" + directory,
                        "server.port=8091");
        runner.run(context -> assertThat(context.getBean(LocalDiskAudioStorage.class).signedUrl("test.wav"))
                .isEqualTo("http://localhost:8091/api/local-audio/test.wav"));
        runner.withPropertyValues("app.storage.local.public-base-url=https://audio.example.com/")
                .run(context -> assertThat(context.getBean(LocalDiskAudioStorage.class).signedUrl("test.wav"))
                        .isEqualTo("https://audio.example.com/api/local-audio/test.wav"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"sb_secret_test-key", "legacy.service-role.jwt"})
    void storageUsesTheCorrectAuthenticationHeaders(String key) throws Exception {
        AtomicReference<String> apiKey = new AtomicReference<>();
        AtomicReference<String> authorization = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/storage/v1/object/sign/music/test.mp3", exchange -> {
            apiKey.set(exchange.getRequestHeaders().getFirst("apikey"));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = "{\"signedURL\":\"/object/sign/music/test.mp3?token=test\"}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (var output = exchange.getResponseBody()) {
                output.write(body);
            }
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            SupabaseAudioStorage storage = new SupabaseAudioStorage(base, "music", key, 1024, 3600);
            assertThat(storage.signedUrl("test.mp3"))
                    .isEqualTo(base + "/storage/v1/object/sign/music/test.mp3?token=test");
            assertThat(apiKey.get()).isEqualTo(key);
            assertThat(authorization.get()).isEqualTo(key.startsWith("sb_secret_") ? null : "Bearer " + key);
        } finally {
            server.stop(0);
        }
    }

}
