package com.cosmiclatte.dev.portfolio.controller;

import com.cosmiclatte.dev.portfolio.common.ApiPaths;
import com.cosmiclatte.dev.portfolio.common.dto.ResponseFormat;
import com.cosmiclatte.dev.portfolio.dto.SharedTrackResponse;
import com.cosmiclatte.dev.portfolio.service.SharedTrackService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import jakarta.servlet.http.HttpServletRequest;
import com.cosmiclatte.dev.portfolio.common.ClientIp;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping(ApiPaths.API)
@RequiredArgsConstructor
public class SharedTrackController {

    private final SharedTrackService sharedTrackService;

    @GetMapping(ApiPaths.SHARED_TRACK)
    public ResponseEntity<ResponseFormat<SharedTrackResponse>> get(@PathVariable String token,
            @RequestParam(value = "visitorId", required = false) String visitorId,
            @RequestHeader(value = "X-Forwarded-For", required = false) String forwardedFor,
            HttpServletRequest request) {
        String ipHash = ClientIp.hash(ClientIp.resolve(forwardedFor, request));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ResponseFormat.success(sharedTrackService.getActive(token, visitorId, ipHash)));
    }
}
