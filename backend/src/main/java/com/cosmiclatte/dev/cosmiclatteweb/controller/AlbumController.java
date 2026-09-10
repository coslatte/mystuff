package com.cosmiclatte.dev.cosmiclatteweb.controller;

import com.cosmiclatte.dev.cosmiclatteweb.common.ApiPaths;
import com.cosmiclatte.dev.cosmiclatteweb.common.dto.ResponseFormat;
import com.cosmiclatte.dev.cosmiclatteweb.service.SoundCloudService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ALBUMS)
@RequiredArgsConstructor
public class AlbumController {

    private final SoundCloudService soundCloudService;

    @GetMapping(ApiPaths.SOUNDCLOUD)
    public ResponseEntity<ResponseFormat<?>> soundcloud() {
        return ResponseEntity.ok(ResponseFormat.success(soundCloudService.listAlbums()));
    }
}
