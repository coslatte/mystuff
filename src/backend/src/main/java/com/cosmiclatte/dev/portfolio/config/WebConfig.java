package com.cosmiclatte.dev.portfolio.config;

import com.cosmiclatte.dev.portfolio.dto.CommentResponse;
import com.cosmiclatte.dev.portfolio.dto.ContactAcceptedResponse;
import com.cosmiclatte.dev.portfolio.dto.CreatedCommentResponse;
import com.cosmiclatte.dev.portfolio.dto.HealthResponse;
import com.cosmiclatte.dev.portfolio.dto.RatingResponse;
import com.cosmiclatte.dev.portfolio.dto.SongResponse;
import com.cosmiclatte.dev.portfolio.dto.SoundCloudAlbumDto;
import io.swagger.v3.core.converter.ModelConverters;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String allowedOrigins;

    public WebConfig(@Value("${app.cors.allowed-origins}") String allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Bean
    public OpenApiCustomizer responseDataSchemas() {
        return openApi -> {
            // Nested @SchemaProperty references are not registered by springdoc.
            for (Class<?> type : new Class<?>[]{SongResponse.class, CommentResponse.class,
                    CreatedCommentResponse.class, RatingResponse.class, SoundCloudAlbumDto.class,
                    HealthResponse.class, ContactAcceptedResponse.class}) {
                ModelConverters.getInstance().read(type).forEach(openApi.getComponents()::addSchemas);
            }
        };
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = allowedOrigins.split(",");
        registry.addMapping("/api/**")
                .allowedOrigins(origins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("X-Error-Id", "Retry-After")
                .allowCredentials(true);
        // The UI polls this to tell a cold start apart from a slow request.
        registry.addMapping("/health")
                .allowedOrigins(origins)
                .allowedMethods("GET", "OPTIONS")
                .allowedHeaders("*");
    }
}
