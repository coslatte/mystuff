package com.cosmiclatte.dev.portfolio.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cosmiclatte.dev.portfolio.common.ApiPaths;
import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.dto.SoundCloudAlbumDto;
import com.cosmiclatte.dev.portfolio.service.SoundCloudService;

import java.util.List;

@RestController
@RequestMapping(ApiPaths.ALBUMS)
@RequiredArgsConstructor
public class AlbumController {

    private final SoundCloudService soundCloudService;

    @GetMapping(ApiPaths.SOUNDCLOUD)
    public ResponseEntity<ResponseFormat<List<SoundCloudAlbumDto>>> soundcloud() {
        return ResponseEntity.ok(ResponseFormat.success(soundCloudService.listAlbums()));
    }
}
