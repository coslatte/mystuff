package com.cosmiclatte.dev.cosmiclatteweb.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
            "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
            "audio/ogg", "audio/webm", "audio/aac", "audio/flac",
            "audio/mp4", "audio/x-m4a", "video/mp4"
    );

    private static final List<String> ALLOWED_EXTENSIONS = List.of(
            ".mp3", ".wav", ".ogg", ".webm", ".aac", ".flac", ".m4a", ".mp4"
    );

    private final Path root;
    private final long maxBytes;

    public FileStorageService(
            @Value("${app.upload-dir:uploads}") String uploadDir,
            @Value("${app.upload-max-bytes:20971520}") long maxBytes) throws IOException {
        this.root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.root);
        this.maxBytes = maxBytes;
        log.info("File storage initialized at {}", this.root);
    }

    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("El archivo de audio es requerido.");
        }
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException(
                    "El archivo excede el tamaño máximo de " + (maxBytes / 1024 / 1024) + " MB.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException("Tipo de archivo no permitido: " + contentType);
        }

        String original = file.getOriginalFilename();
        String extension = "";
        if (original != null) {
            int dot = original.lastIndexOf('.');
            if (dot >= 0) {
                extension = original.substring(dot).toLowerCase();
            }
        }
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("Extensión de archivo no permitida: " + extension);
        }

        String filename = UUID.randomUUID() + extension;
        try {
            Path destination = root.resolve(filename).normalize();
            if (!destination.startsWith(root)) {
                throw new IllegalArgumentException("Nombre de archivo inválido.");
            }
            Files.copy(file.getInputStream(), destination);
            return filename;
        } catch (IOException e) {
            throw new RuntimeException("No se pudo guardar el archivo: " + e.getMessage(), e);
        }
    }

    public Resource load(String filename) {
        Path file = resolveSafe(filename);
        try {
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            }
            throw new IllegalArgumentException("Archivo no encontrado: " + filename);
        } catch (MalformedURLException e) {
            throw new IllegalArgumentException("Archivo no encontrado: " + filename, e);
        }
    }

    public void delete(String filename) {
        if (filename == null || filename.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(resolveSafe(filename));
        } catch (IOException e) {
            log.warn("No se pudo eliminar el archivo {}: {}", filename, e.getMessage());
        }
    }

    public String contentType(String filename) {
        int dot = filename.lastIndexOf('.');
        String ext = dot >= 0 ? filename.substring(dot).toLowerCase() : "";
        return switch (ext) {
            case ".mp3" -> "audio/mpeg";
            case ".wav" -> "audio/wav";
            case ".ogg" -> "audio/ogg";
            case ".webm" -> "audio/webm";
            case ".aac" -> "audio/aac";
            case ".flac" -> "audio/flac";
            case ".m4a" -> "audio/mp4";
            case ".mp4" -> "video/mp4";
            default -> "application/octet-stream";
        };
    }

    private Path resolveSafe(String filename) {
        Path file = root.resolve(filename).normalize();
        if (!file.startsWith(root)) {
            throw new IllegalArgumentException("Nombre de archivo inválido: " + filename);
        }
        return file;
    }
}
