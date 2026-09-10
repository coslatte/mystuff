package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.common.ApiPaths;
import com.cosmiclatte.dev.cosmiclatteweb.common.dto.ResponseFormat;
import com.cosmiclatte.dev.cosmiclatteweb.common.exception.ForbiddenException;
import com.cosmiclatte.dev.cosmiclatteweb.config.AdminAuth;
import com.cosmiclatte.dev.cosmiclatteweb.service.SongService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping(ApiPaths.SONGS)
@RequiredArgsConstructor
public class SongController {

    private final SongService songService;
    private final AdminAuth adminAuth;

    @GetMapping
    public ResponseEntity<ResponseFormat<?>> list() {
        return ResponseEntity.ok(ResponseFormat.success(songService.listSongs()));
    }

    @GetMapping(ApiPaths.SONG_ID)
    public ResponseEntity<ResponseFormat<?>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ResponseFormat.success(songService.getSong(id)));
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<ResponseFormat<?>> create(
            @RequestPart("title") String title,
            @RequestPart("artist") String artist,
            @RequestPart(value = "duration", required = false) String duration,
            @RequestPart("file") MultipartFile file,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ResponseFormat.success(songService.createSong(title, artist, duration, file)));
    }

    @PutMapping(value = ApiPaths.SONG_AUDIO, consumes = "multipart/form-data")
    public ResponseEntity<ResponseFormat<?>> replaceAudio(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return ResponseEntity.ok(ResponseFormat.success(songService.replaceAudio(id, file)));
    }

    @DeleteMapping(ApiPaths.SONG_ID)
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        songService.deleteSong(id);
        return ResponseEntity.noContent().build();
    }

    private void requireAdmin(String adminKey) {
        if (!adminAuth.isAdmin(adminKey)) {
            throw new ForbiddenException("Admin key is required to manage songs.");
        }
    }
}
