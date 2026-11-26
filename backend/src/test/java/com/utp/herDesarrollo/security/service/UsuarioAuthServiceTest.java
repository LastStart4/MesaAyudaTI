package com.utp.herDesarrollo.security.service;

import com.utp.herDesarrollo.security.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class UsuarioAuthServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Test
    void noDebeSembrarCuentasDeDemostracionCuandoLaFuncionEstaDesactivada() {
        UsuarioAuthService service = new UsuarioAuthService(
                usuarioRepository,
                passwordEncoder,
                "",
                "",
                false
        );

        service.asegurarUsuariosBase();

        verifyNoInteractions(usuarioRepository, passwordEncoder);
    }
}
