package com.utp.herDesarrollo.security.dto;

/**
 * DTO para el registro de un usuario de la Mesa de Ayuda TI.
 */
public record RegistroUsuarioDTO(
        String username,
        String nombreCompleto,
        String correo,
        String password,
        String rol,
        String especialidad
) {
}
