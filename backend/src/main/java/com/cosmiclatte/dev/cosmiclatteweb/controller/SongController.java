package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.config.AdminAuth;
import com.cosmiclatte.dev.cosmiclatteweb.dto.SongResponse;
import com.cosmiclatte.dev.cosmiclatteweb.service.SongService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/songs")
public class SongController {

    private final SongService songService;
    private final AdminAuth adminAuth;

    public SongController(SongService songService, AdminAuth adminAuth) {
        this.songService = songService;
        this.adminAuth = adminAuth;
    }

    @GetMapping
    public List<SongResponse> list() {
        return songService.listSongs();
    }

    @GetMapping("/{id}")
    public SongResponse get(@PathVariable Long id) {
        return songService.getSong(id);
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<SongResponse> create(
            @RequestPart("title") String title,
            @RequestPart("artist") String artist,
            @RequestPart(value = "duration", required = false) String duration,
            @RequestPart("file") MultipartFile file,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        SongResponse created = songService.createSong(title, artist, duration, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping(value = "/{id}/audio", consumes = "multipart/form-data")
    public SongResponse replaceAudio(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        return songService.replaceAudio(id, file);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @RequestHeader(value = "X-Admin-Key", required = false) String adminKey) {
        requireAdmin(adminKey);
        songService.deleteSong(id);
        return ResponseEntity.noContent().build();
    }

    private void requireAdmin(String adminKey) {
        if (!adminAuth.isAdmin(adminKey)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Se requiere clave de administrador para gestionar canciones.");
        }
    }
}
