// ==================== CONFIGURACIÓN ====================
// Inicializar Supabase
const supabaseUrl = 'https://pgprfmrormidbbvrnwaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBncHJmbXJvcm1pZGJidnJud2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDIyODEsImV4cCI6MjA5MTQxODI4MX0.r0Igx_uWxf38Bwa7kTAjjd2LY6KCgqRictEMXWcyVvQ';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Claves de localStorage
const LS_PRODUCTOS = 'AZADOSk_productos';
const LS_ACTUALIZACION = 'AZADOSk_productos_actualizados';
const LS_SESSION = 'AZADOSk_admin_session';
const LS_REMEMBER_ME = 'AZADOSk_admin_remember';

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async () => {
    // PRIMERO: Verificar seguridad del cliente (capa de protección)
    const seguridadClienteOK = verificarSeguridadCliente();
    
    if (!seguridadClienteOK) {
        // Redirigir al index si no pasó la seguridad del cliente
        window.location.href = 'index.html';
        return;
    }
    
    // POR DEFECTO: Mostrar panel y ocultar login inicialmente (evita flash)
    // El panel se mostrará mientras verificamos la sesión en segundo plano
    document.body.classList.add('verificando-sesion');
    mostrarPanelAdmin(true); // true = modo silencioso (sin notificación)
    
    // Depurar estado del usuario en segundo plano
    depurarUsuario();

    // Verificar sesión persistente
    const sesionRestaurada = await restaurarSesion();
    
    if (!sesionRestaurada) {
        // Verificar si hay sesión activa en Supabase
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user && await verificarRolAdmin(user.id)) {
            // Guardar sesión en localStorage para persistencia
            guardarSesionLocal(user);
            // Panel ya está visible, solo cargar datos
        } else {
            // No hay sesión válida, mostrar login
            mostrarLogin();
        }
    }
    
    // Quitar clase de verificación
    document.body.classList.remove('verificando-sesion');

    // Cargar productos
    cargarProductos();
});

// ==================== SEGURIDAD CLIENTE ====================
// Verifica que el usuario venga del modal de seguridad del cliente
function verificarSeguridadCliente() {
    // Permitir acceso si viene del login de Supabase (parámetro en URL)
    const urlParams = new URLSearchParams(window.location.search);
    const fromSupabase = urlParams.get('from') === 'supabase';
    
    if (fromSupabase) {
        // Limpiar el parámetro de la URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
    }
    
    // Verificar sessionStorage del cliente (creado por script.js)
    const ADMIN_SESSION_KEY = 'AZADOSk_admin_access_verified';
    const sessionStr = sessionStorage.getItem(ADMIN_SESSION_KEY);
    
    if (!sessionStr) return false;
    
    try {
        const session = JSON.parse(sessionStr);
        
        // Verificar si expiró (30 minutos)
        if (Date.now() > session.expiresAt) {
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
            return false;
        }
        
        // Renovar sesión por 30 minutos más
        session.expiresAt = Date.now() + (30 * 60 * 1000);
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
        
        return true;
    } catch (error) {
        return false;
    }
}

// ==================== PERSISTENCIA DE SESIÓN ====================

function guardarSesionLocal(user) {
    try {
        const sessionData = {
            userId: user.id,
            email: user.email,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 días
        };
        localStorage.setItem(LS_SESSION, JSON.stringify(sessionData));
    } catch (error) {
        console.error('Error guardando sesión local:', error);
    }
}

function obtenerSesionLocal() {
    try {
        const sessionStr = localStorage.getItem(LS_SESSION);
        if (!sessionStr) return null;
        
        const session = JSON.parse(sessionStr);
        
        // Verificar si la sesión expiró
        if (new Date(session.expiresAt) < new Date()) {
            localStorage.removeItem(LS_SESSION);
            return null;
        }
        
        return session;
    } catch (error) {
        console.error('Error obteniendo sesión local:', error);
        return null;
    }
}

async function restaurarSesion() {
    const sessionLocal = obtenerSesionLocal();
    
    if (!sessionLocal) return false;
    
    try {
        // Verificar sesión en Supabase
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error || !user) {
            // Intentar refrescar sesión
            const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
            
            if (refreshError || !refreshData.user) {
                console.log('No se pudo restaurar sesión');
                localStorage.removeItem(LS_SESSION);
                return false;
            }
            
            // Verificar rol de admin
            if (await verificarRolAdmin(refreshData.user.id)) {
                guardarSesionLocal(refreshData.user);
                mostrarPanelAdmin();
                return true;
            }
        } else if (user.id === sessionLocal.userId) {
            // Sesión válida
            if (await verificarRolAdmin(user.id)) {
                mostrarPanelAdmin();
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error restaurando sesión:', error);
        return false;
    }
}

function limpiarSesionLocal() {
    localStorage.removeItem(LS_SESSION);
    localStorage.removeItem(LS_REMEMBER_ME);
}

// ==================== AUTENTICACIÓN ====================
async function autenticar(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const contrasena = document.getElementById('contrasena').value;

    if (!email || !email.includes('@')) {
        mostrarNotificacion('Ingresa un correo electrónico válido', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password: contrasena
        });

        if (error) {
            mostrarNotificacion('Error de autenticación: ' + error.message, 'error');
            return;
        }

        // Verificar si es admin
         ('Usuario autenticado:', data.user.id);
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

         ('Perfil obtenido:', profile);
         ('Error del perfil:', profileError);

        if (profileError || !profile || profile.role !== 'admin') {
             ('Usuario no es admin o error en perfil');
            mostrarNotificacion('No tienes permisos de administrador', 'error');
            await supabaseClient.auth.signOut();
            return;
        }

         ('Usuario es admin, mostrando panel');
        mostrarNotificacion('¡Bienvenido! Sesión iniciada correctamente', 'success');
        
        // Guardar sesión en localStorage para persistencia
        guardarSesionLocal(data.user);
        
        setTimeout(() => {
            mostrarPanelAdmin();
        }, 500);
    } catch (error) {
        mostrarNotificacion('Error al iniciar sesión: ' + error.message, 'error');
    }
}

async function verificarRolAdmin(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

         ('Verificando rol para userId:', userId);
         ('Resultado:', data, 'Error:', error);
        return !error && data && data.role === 'admin';
    } catch (error) {
        console.error('Error verificando rol:', error);
        return false;
    }
}

// Función para actualizar rol a admin (para desarrollo)
async function hacerAdmin() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ role: 'admin' })
                .eq('id', user.id);

            if (error) {
                console.error('Error actualizando rol:', error);
            } else {
                 ('Rol actualizado a admin');
                location.reload(); // Recargar página
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Función para crear perfil si no existe
async function crearPerfil() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            const { error } = await supabaseClient
                .from('profiles')
                .insert({ id: user.id, email: user.email, role: 'admin' });

            if (error) {
                console.error('Error creando perfil:', error);
            } else {
                 ('Perfil creado');
                location.reload();
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Función para depurar estado del usuario
async function depurarUsuario() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const debugDiv = document.getElementById('debugInfo');

        if (user) {
             ('Usuario actual:', user);
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
             ('Perfil del usuario:', profile);

            let debugText = `Usuario: ${user.email}<br>`;
            if (profile) {
                debugText += `Rol: ${profile.role}<br>`;
                if (profile.role !== 'admin') {
                    debugText += `<button onclick="hacerAdmin()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">Hacer Admin</button>`;
                }
            } else {
                debugText += `Perfil: No encontrado<br>`;
                debugText += `<button onclick="crearPerfil()" style="margin-top: 10px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Crear Perfil</button>`;
            }

            if (debugDiv) debugDiv.innerHTML = debugText;
        } else {
             ('No hay usuario autenticado');
            if (debugDiv) debugDiv.innerHTML = 'No hay usuario autenticado';
        }
    } catch (error) {
        console.error('Error en depuración:', error);
        const debugDiv = document.getElementById('debugInfo');
        if (debugDiv) debugDiv.innerHTML = `Error: ${error.message}`;
    }
}

function mostrarModalCerrarSesion() {
    const modal = document.getElementById('logoutModal');
    
    // Actualizar nombre de la app si está disponible
    const nombreApp = document.getElementById('confNombreApp')?.value || 'AZADOS K';
    document.getElementById('logoutAppName').textContent = nombreApp;
    
    modal.classList.add('show');
}

// ==================== MENÚ HAMBURGUESA ====================
function toggleMenu() {
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const menuToggle = document.getElementById('menuToggle');
    
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
    menuToggle.classList.toggle('active');
}

// Cerrar menú al cambiar de sección (en móvil)
function cerrarMenuSiMovil() {
    // En móvil, cerrar el menú después de seleccionar
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('adminSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const menuToggle = document.getElementById('menuToggle');
        
        if (sidebar && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
            overlay.classList.remove('show');
            menuToggle.classList.remove('active');
        }
    }
}

function cancelarCerrarSesion() {
    document.getElementById('logoutModal').classList.remove('show');
}

// Cerrar modal logout al hacer clic fuera
document.addEventListener('click', (e) => {
    const modal = document.getElementById('logoutModal');
    if (modal && modal.classList.contains('show')) {
        if (e.target === modal) {
            cancelarCerrarSesion();
        }
    }
});

async function confirmarCerrarSesion() {
    // Limpiar sesión local
    limpiarSesionLocal();
    
    // Limpiar sesión de seguridad del cliente para que pida clave al reingresar
    sessionStorage.removeItem('AZADOSk_admin_access_verified');
    
    // Ocultar modal
    document.getElementById('logoutModal').classList.remove('show');
    
    await supabaseClient.auth.signOut();
    mostrarNotificacion('Sesión cerrada correctamente', 'success');
    setTimeout(() => {
        mostrarLogin();
    }, 500);
}

async function cerrarSesion() {
    mostrarModalCerrarSesion();
}

function mostrarLogin() {
    document.getElementById('loginContainer').classList.remove('hidden');
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('adminPanel').style.display = 'none';
    document.body.style.background = 'linear-gradient(135deg, #FF6B35 0%, #004E89 100%)';
}

async function mostrarPanelAdmin(modoSilencioso = false) {
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('adminPanel').style.display = 'flex';
    document.body.style.background = '';

    // Mostrar email de usuario
    const { data: { user } } = await supabaseClient.auth.getUser();
    document.getElementById('usuarioActual').textContent = `👤 ${user.email}`;

    // Cargar datos iniciales
    cargarTablaProductos();
    actualizarEstadisticas();
}

// ==================== GESTIÓN DE PRODUCTOS ====================
let productos = [];
let productoEditando = null;

async function cargarProductos() {
    try {
        const { data, error } = await supabaseClient
            .from('productos')
            .select('*');

        if (error) {
            console.error('Error cargando productos desde Supabase:', error);
            productos = getProductosPorDefectoAdmin();
        } else if (data && data.length > 0) {
            productos = data;
        } else {
            productos = getProductosPorDefectoAdmin();
        }
        
        // Renderizar la tabla después de cargar productos
        cargarTablaProductos();
        actualizarEstadisticas();
    } catch (error) {
        console.error('Error conectando con Supabase:', error);
        productos = getProductosPorDefectoAdmin();
        cargarTablaProductos();
        actualizarEstadisticas();
    }
}

function getProductosPorDefectoAdmin() {
    return [
        { id: 1, nombre: 'Picada Personal', categoria: 'picadas', descripcion: 'Costilla de cerdo, chicharrón, chorizo, papa, yuca y salsa de la casa. Trae 150 gr', ingredientes: 'Costilla de cerdo asada al barril, chicharrón crujiente, chorizo santarosano, papas asadas, yuca frita, salsa de la casa', detalles: 'Porción individual perfecta para 1 persona.', emoji: '🍖', precio: 18000, stock: 20 },
        { id: 2, nombre: 'Picada Doble', categoria: 'picadas', descripcion: 'Costilla de cerdo, chicharrón, chorizo, papa, yuca y salsa de la casa. Trae 320 gr', ingredientes: 'Doble porción de costilla de cerdo asada al barril, chicharrón crujiente, chorizo santarosano, papas asadas, yuca frita, salsa de la casa', detalles: 'Ideal para compartir entre 2 personas.', emoji: '🍗', precio: 37000, stock: 15 },
        { id: 3, nombre: 'Picada Familiar', categoria: 'picadas', descripcion: 'Costilla de cerdo, chicharrón, chorizo, papa, yuca y salsa de la casa. Trae 750 gr', ingredientes: 'Gran porción familiar de costilla de cerdo asada al barril, chicharrón crujiente, chorizo santarosano, papas asadas, yuca frita, salsa de la casa', detalles: 'Perfecta para familias o grupos pequeños.', emoji: '🍲', precio: 70000, stock: 10 },
        { id: 5, nombre: 'Chorizo Santarosano', categoria: 'asado', descripcion: 'Chorizo santarosano con papa y salsa de la casa. Delicioso y auténtico', ingredientes: 'Chorizo santarosano 100% carne de cerdo, papa asada, salsa de la casa', detalles: 'Receta tradicional de la región.', emoji: '🌶️', precio: 7000, stock: 30 },
        { id: 6, nombre: 'Costilla 100gr', categoria: 'adicionales', descripcion: 'Costilla de cerdo asada al barril. 100 gramos de pura satisfacción', ingredientes: 'Costilla de cerdo premium asada al barril, sal y condimentos naturales', detalles: 'Corte premium preparado lentamente.', emoji: '🍖', precio: 9000, stock: 25 },
        { id: 7, nombre: 'Chicharrón 100gr', categoria: 'adicionales', descripcion: 'Chicharrón crujiente 100 gramos. Acompañamiento perfecto', ingredientes: 'Piel de cerdo frita hasta lograr la textura crujiente perfecta, sal marina', detalles: 'Preparado artesanalmente.', emoji: '✨', precio: 9000, stock: 25 },
        { id: 8, nombre: 'Chorizo', categoria: 'adicionales', descripcion: 'Chorizo asado 100 gramos. Sabor incomparable', ingredientes: 'Chorizo 100% carne de cerdo, ajo, pimienta, sal', detalles: 'Chorizo artesanal con condimentos tradicionales.', emoji: '🌶️', precio: 6000, stock: 40 },
        { id: 9, nombre: 'Papas', categoria: 'adicionales', descripcion: 'Papas asadas. El acompañamiento ideal', ingredientes: 'Papas frescas, aceite de oliva, sal marina, romero', detalles: 'Preparadas al horno con hierbas aromáticas.', emoji: '🥔', precio: 3000, stock: 50 },
        { id: 10, nombre: 'Yucas', categoria: 'adicionales', descripcion: 'Yucas fritas deliciosas. Perfectas para acompañar', ingredientes: 'Yuca fresca, aceite vegetal para freír, sal marina', detalles: 'Yuca fresca cortada en bastones y frita.', emoji: '🍗', precio: 3000, stock: 50 }
    ];
}

async function guardarProductosLocal() {
    try {
        // Primero, eliminar todos los productos existentes
        await supabaseClient.from('productos').delete().neq('id', 0);

        // Insertar los productos actualizados
        const { error } = await supabaseClient
            .from('productos')
            .insert(productos);

        if (error) {
            console.error('Error guardando productos en Supabase:', error);
            mostrarNotificacion('Error al guardar productos', 'error');
        } else {
            // Notificar actualización
            localStorage.setItem(LS_ACTUALIZACION, Date.now().toString());
            mostrarNotificacion('Productos guardados correctamente', 'success');
        }
    } catch (error) {
        console.error('Error conectando con Supabase:', error);
        mostrarNotificacion('Error de conexión', 'error');
    }
}

// ==================== GESTIÓN DE IMÁGENES MODERNA ====================

// Previsualizar imagen seleccionada con UI moderna
function previewImagenModerno(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    
    // Validar tipo de archivo
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!tiposPermitidos.includes(file.type)) {
        mostrarNotificacion('Solo se permiten imágenes JPG, PNG, WebP o GIF', 'error');
        input.value = '';
        return;
    }
    
    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
        mostrarNotificacion('La imagen no debe superar los 5MB', 'error');
        input.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewImg = document.getElementById('previewImagen');
        const uploadArea = document.getElementById('uploadArea');
        
        previewImg.src = e.target.result;
        uploadArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
}

// Eliminar previsualización de imagen
function eliminarImagenPreview() {
    const input = document.getElementById('imagenProducto');
    const uploadArea = document.getElementById('uploadArea');
    const previewImg = document.getElementById('previewImagen');
    
    input.value = '';
    previewImg.src = '';
    uploadArea.classList.remove('has-image');
}

// Configurar drag & drop para el área de upload
document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('imagenProducto');
    
    if (uploadArea && fileInput) {
        // Drag enter
        uploadArea.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        });
        
        // Drag over
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        });
        
        // Drag leave
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target === uploadArea) {
                uploadArea.classList.remove('dragover');
            }
        });
        
        // Drop
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files && files[0]) {
                fileInput.files = files;
                previewImagenModerno(fileInput);
            }
        });
    }
});

// Función legacy para compatibilidad (llama a la moderna)
function previewImagen(input) {
    previewImagenModerno(input);
}

async function subirImagenProducto(file, productoId) {
    try {
        // Generar nombre único
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `producto-${productoId}-${Date.now()}.${fileExt}`;
        const filePath = `productos/${fileName}`;

        // Subir archivo
        const { error: uploadError } = await supabaseClient
            .storage
            .from('productos-imagenes')
            .upload(filePath, file, {
                contentType: file.type
            });

        if (uploadError) {
            console.error('Error subiendo imagen:', uploadError);
            throw uploadError;
        }

        // Obtener URL pública
        const { data: { publicUrl } } = supabaseClient
            .storage
            .from('productos-imagenes')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Error en subirImagenProducto:', error);
        mostrarNotificacion('Error al subir imagen: ' + error.message, 'error');
        return null;
    }
}

async function eliminarImagenProducto(imageUrl) {
    if (!imageUrl) return;
    try {
        // Extraer el path de la URL
        const urlParts = imageUrl.split('productos-imagenes/');
        if (urlParts.length < 2) return;

        const filePath = urlParts[1];

        const { error } = await supabaseClient
            .storage
            .from('productos-imagenes')
            .remove([filePath]);

        if (error) {
            console.error('Error eliminando imagen del storage:', error);
        }
    } catch (error) {
        console.error('Error en eliminarImagenProducto:', error);
    }
}

function cargarTablaProductos(filtro = {}) {
    const tbody = document.getElementById('productosTableBody');
    tbody.innerHTML = '';

    let productosFiltrados = productos;

    // Aplicar filtros
    if (filtro.busqueda) {
        productosFiltrados = productosFiltrados.filter(p =>
            p.nombre.toLowerCase().includes(filtro.busqueda.toLowerCase()) ||
            p.descripcion.toLowerCase().includes(filtro.busqueda.toLowerCase())
        );
    }

    if (filtro.categoria) {
        productosFiltrados = productosFiltrados.filter(p => p.categoria === filtro.categoria);
    }

    if (productosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">No hay productos que coincidan con los filtros</td></tr>';
        return;
    }

    productosFiltrados.forEach(producto => {
        const row = document.createElement('tr');
        const imagenHtml = producto.imagen_url
            ? `<img src="${producto.imagen_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; margin-right: 8px;" onerror="this.style.display='none'">`
            : '';
        row.innerHTML = `
            <td><strong>#${producto.id}</strong></td>
            <td style="display: flex; align-items: center;">${imagenHtml}${producto.emoji} ${producto.nombre}</td>
            <td><span class="category-tag">${traducirCategoria(producto.categoria)}</span></td>
            <td>${producto.descripcion.substring(0, 50)}...</td>
            <td><strong>$${formatearPrecio(producto.precio)}</strong></td>
            <td><span class="stock-tag ${producto.stock <= 5 ? 'low-stock' : ''}">${producto.stock || 0}</span></td>
            <td>
                <div class="actions">
                    <button class="action-btn edit-btn" onclick="editarProducto(${producto.id})">✏️ Editar</button>
                    <button class="action-btn delete-btn" onclick="eliminarProducto(${producto.id})">🗑️ Eliminar</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filtrarProductos() {
    const busqueda = document.getElementById('searchInput').value;
    const categoria = document.getElementById('categoryFilter').value;

    cargarTablaProductos({ busqueda, categoria });
}

async function guardarProducto(event) {
    event.preventDefault();

    const id = document.getElementById('productoId').value;
    const nombre = document.getElementById('nombre').value;
    const categoria = document.getElementById('categoria').value;
    const emojiInput = document.getElementById('emoji').value.trim();
    const precio = parseInt(document.getElementById('precio').value);
    const stock = parseInt(document.getElementById('stock').value);
    const descripcion = document.getElementById('descripcion').value;
    const ingredientes = document.getElementById('ingredientes').value;
    const detalles = document.getElementById('detalles').value;
    const imagenUrlActual = document.getElementById('imagenUrlActual').value;
    const imagenInput = document.getElementById('imagenProducto');

    // Emoji por defecto según categoría
    const emojiPorDefecto = {
        'picadas': '🍖',
        'asado': '🔥',
        'adicionales': '🍟'
    };
    const emoji = emojiInput || emojiPorDefecto[categoria] || '🍽️';

    if (!nombre || !categoria || !precio || !descripcion || !ingredientes || !detalles || stock === undefined) {
        mostrarNotificacion('Por favor completa todos los campos obligatorios', 'error');
        return;
    }

    let imagenUrl = imagenUrlActual || null;

    // Si hay una nueva imagen seleccionada, subirla
    if (imagenInput?.files?.[0]) {
        const productoId = id ? parseInt(id) : Math.max(...productos.map(p => p.id), 0) + 1;
        const nuevaUrl = await subirImagenProducto(imagenInput.files[0], productoId);
        if (nuevaUrl) {
            // Eliminar imagen anterior si existe y es diferente
            if (imagenUrlActual && imagenUrlActual !== nuevaUrl) {
                await eliminarImagenProducto(imagenUrlActual);
            }
            imagenUrl = nuevaUrl;
        }
    }

    if (id) {
        // Editar producto existente
        const producto = productos.find(p => p.id === parseInt(id));
        if (producto) {
            producto.nombre = nombre;
            producto.categoria = categoria;
            producto.emoji = emoji;
            producto.precio = precio;
            producto.stock = stock;
            producto.descripcion = descripcion;
            producto.ingredientes = ingredientes;
            producto.detalles = detalles;
            producto.imagen_url = imagenUrl;
            mostrarNotificacion('Producto actualizado correctamente', 'success');
        }
    } else {
        // Crear nuevo producto
        const nuevoId = Math.max(...productos.map(p => p.id), 0) + 1;
        productos.push({
            id: nuevoId,
            nombre,
            categoria,
            emoji,
            precio,
            stock,
            descripcion,
            ingredientes,
            detalles,
            imagen_url: imagenUrl
        });
        mostrarNotificacion('Producto creado correctamente', 'success');
    }

    await guardarProductosLocal();
    limpiarFormulario();
    cargarTablaProductos();
    cambiarSeccion('productos');
}

function syncProductos() {
    localStorage.setItem(LS_ACTUALIZACION, Date.now().toString());
}

function editarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (producto) {
        document.getElementById('productoId').value = producto.id;
        document.getElementById('nombre').value = producto.nombre;
        document.getElementById('categoria').value = producto.categoria;
        document.getElementById('emoji').value = producto.emoji;
        document.getElementById('precio').value = producto.precio;
        document.getElementById('stock').value = producto.stock || 0;
        document.getElementById('descripcion').value = producto.descripcion;
        document.getElementById('ingredientes').value = producto.ingredientes || '';
        document.getElementById('detalles').value = producto.detalles || '';

        // Cargar imagen actual si existe
        const imagenUrlActual = document.getElementById('imagenUrlActual');
        const previewImagen = document.getElementById('previewImagen');
        if (producto.imagen_url) {
            imagenUrlActual.value = producto.imagen_url;
            previewImagen.src = producto.imagen_url;
            previewImagen.style.display = 'block';
        } else {
            imagenUrlActual.value = '';
            previewImagen.style.display = 'none';
        }

        document.getElementById('formTitle').textContent = 'Editar Producto';
        document.getElementById('btnCancelar').classList.remove('hidden');
        document.getElementById('btnCancelar').style.display = 'inline-block';

        cambiarSeccion('agregar');
        window.scrollTo(0, 0);
    }
}

async function eliminarProducto(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        // Buscar producto para eliminar su imagen también
        const producto = productos.find(p => p.id === id);
        if (producto?.imagen_url) {
            await eliminarImagenProducto(producto.imagen_url);
        }

        productos = productos.filter(p => p.id !== id);
        await guardarProductosLocal();
        cargarTablaProductos();
        mostrarNotificacion('Producto eliminado correctamente', 'success');
        syncProductos();
    }
}

function limpiarFormulario() {
    document.getElementById('productForm').reset();
    document.getElementById('productoId').value = '';
    document.getElementById('imagenUrlActual').value = '';
    eliminarImagenPreview(); // Limpiar preview moderno
    document.getElementById('formTitle').textContent = 'Agregar Nuevo Producto';
    document.getElementById('btnCancelar').classList.add('hidden');
}

// ==================== NAVEGACIÓN ====================
function cambiarSeccion(seccion) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
    });

    // Desactivar todos los botones
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Mostrar sección seleccionada
    document.getElementById(seccion + 'Section').classList.add('active');

    // Activar botón
    event.target.classList.add('active');

    // Cargar datos si es necesario
    if (seccion === 'productos') {
        cargarTablaProductos();
    } else if (seccion === 'estadisticas') {
        actualizarEstadisticas();
    }
}

// ==================== ESTADÍSTICAS ====================
function actualizarEstadisticas() {
    const totalProductos = productos.length;
    const productosActivos = productos.length;
    const precioPromedio = Math.round(productos.reduce((sum, p) => sum + p.precio, 0) / productos.length);
    const productoMasCaro = Math.max(...productos.map(p => p.precio));

    document.getElementById('totalProductos').textContent = totalProductos;
    document.getElementById('productosActivos').textContent = productosActivos;
    document.getElementById('precioPromedio').textContent = `$${formatearPrecio(precioPromedio)}`;
    document.getElementById('productoMasCaro').textContent = `$${formatearPrecio(productoMasCaro)}`;

    // Actualizar estadísticas por categoría
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = '';

    const categorias = ['picadas', 'asado', 'adicionales'];
    categorias.forEach(cat => {
        const count = productos.filter(p => p.categoria === cat).length;
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
            <span class="category-name">${traducirCategoria(cat)}</span>
            <span class="category-count">${count} productos</span>
        `;
        categoryList.appendChild(item);
    });
}

// ==================== EXPORTAR E IMPORTAR ====================
function exportarProductos() {
    const dataStr = JSON.stringify(productos, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AZADOS-k-productos-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    mostrarNotificacion('Productos exportados correctamente', 'success');
}

async function resetearProductos() {
    if (confirm('¿Deseas restaurar todos los productos a los valores originales? Esta acción no se puede deshacer.')) {
        await cargarProductos();
        localStorage.removeItem(LS_PRODUCTOS);
        await cargarProductos();
        await guardarProductosLocal();
        cargarTablaProductos();
        actualizarEstadisticas();
        mostrarNotificacion('Productos restaurados a valores originales', 'success');
        syncProductos();
    }
}

// ==================== UTILIDADES ====================
function traducirCategoria(categoria) {
    const traducciones = {
        'picadas': 'Picadas',
        'asado': 'Asado al Barril',
        'adicionales': 'Adiciones'
    };
    return traducciones[categoria] || categoria;
}

function formatearPrecio(precio) {
    return precio.toLocaleString('es-CO');
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.className = `toast show ${tipo}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== SINCRONIZACIÓN CON LA PÁGINA PRINCIPAL ====================
// Los productos se sincronizan automáticamente a través del localStorage
// La página principal (index.html) escuchará las claves 'AZADOSk_productos' y 'AZADOSk_productos_actualizados' para recargar datos

// ==================== PANEL ADMINISTRATIVO COMPLETO ====================

// ==================== DASHBOARD ====================
async function cargarDashboard() {
    try {
        // Cargar estadísticas
        const { data: productos, error: prodError } = await supabaseClient
            .from('productos')
            .select('*');
        
        const { data: categorias, error: catError } = await supabaseClient
            .from('categorias')
            .select('*');
        
        // KPIs
        document.getElementById('dashTotalProductos').textContent = productos?.length || 0;
        document.getElementById('dashTotalCategorias').textContent = categorias?.length || 0;
        
        // Pedidos de hoy
        const hoy = new Date().toISOString().split('T')[0];
        const { data: pedidosHoy, error: pedError } = await supabaseClient
            .from('pedidos')
            .select('*')
            .gte('creado_en', hoy + 'T00:00:00')
            .lt('creado_en', hoy + 'T23:59:59');
        
        document.getElementById('dashPedidosHoy').textContent = pedidosHoy?.length || 0;
        const ventasHoy = pedidosHoy?.reduce((sum, p) => sum + (p.total || 0), 0) || 0;
        document.getElementById('dashVentasHoy').textContent = '$' + formatearPrecio(ventasHoy);
        
        // Estado del negocio (horarios)
        await cargarEstadoNegocio();
        
        // Últimos pedidos
        await cargarUltimosPedidos();
        
        // Productos con bajo stock
        await cargarBajoStock(productos || []);
        
        // Actualizar timestamp
        document.getElementById('lastUpdated').textContent = 'Actualizado: ' + new Date().toLocaleTimeString();
        
    } catch (error) {
        console.error('Error cargando dashboard:', error);
    }
}

async function cargarEstadoNegocio() {
    try {
        const { data: horarios, error } = await supabaseClient
            .from('horarios')
            .select('*')
            .order('dia_semana');
        
        if (error) throw error;
        
        const ahora = new Date();
        const diaSemana = ahora.getDay();
        const horaActual = ahora.getHours() + ':' + String(ahora.getMinutes()).padStart(2, '0');
        
        const horarioHoy = horarios?.find(h => h.dia_semana === diaSemana);
        const estadoDiv = document.getElementById('dashEstadoNegocio');
        
        if (!horarioHoy || !horarioHoy.abierto) {
            estadoDiv.innerHTML = `
                <div class="dash-status cerrado">
                    <strong>CERRADO</strong>
                    <p>Hoy no abrimos</p>
                </div>`;
            estadoDiv.className = 'dash-status cerrado';
            return;
        }
        
        const abierto = horaActual >= horarioHoy.hora_apertura && horaActual <= horarioHoy.hora_cierre;
        const proximoCierre = horarioHoy.hora_cierre;
        
        estadoDiv.innerHTML = `
            <div class="dash-status ${abierto ? 'abierto' : 'cerrado'}">
                <strong>${abierto ? 'ABIERTO' : 'CERRADO'}</strong>
                <p>Hoy: ${horarioHoy.hora_apertura} - ${horarioHoy.hora_cierre}</p>
                ${abierto ? `<p>Cierra a las ${proximoCierre}</p>` : ''}
            </div>`;
        estadoDiv.className = `dash-status ${abierto ? 'abierto' : 'cerrado'}`;
        
    } catch (error) {
        console.error('Error cargando estado:', error);
    }
}

async function cargarUltimosPedidos() {
    try {
        const { data: pedidos, error } = await supabaseClient
            .from('pedidos')
            .select('*')
            .order('creado_en', { ascending: false })
            .limit(5);
        
        const container = document.getElementById('dashUltimosPedidos');
        
        if (!pedidos || pedidos.length === 0) {
            container.innerHTML = '<p>No hay pedidos recientes</p>';
            return;
        }
        
        container.innerHTML = pedidos.map(p => `
            <div class="dash-item">
                <div>
                    <strong>#${p.numero_pedido}</strong> - ${p.cliente_nombre}
                    <br><small>${new Date(p.creado_en).toLocaleString()}</small>
                </div>
                <div style="text-align: right;">
                    <span class="estado-badge estado-${p.estado}">${p.estado}</span>
                    <br><strong>$${formatearPrecio(p.total)}</strong>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando pedidos:', error);
    }
}

async function cargarBajoStock(productos) {
    const bajoStock = productos.filter(p => p.stock <= 5);
    const container = document.getElementById('dashBajoStock');
    
    if (bajoStock.length === 0) {
        container.innerHTML = '<p style="color: #28a745;">✓ Todos los productos tienen stock suficiente</p>';
        return;
    }
    
    container.innerHTML = bajoStock.map(p => `
        <div class="dash-item" style="color: ${p.stock === 0 ? '#dc3545' : '#ffc107'};">
            <span>${p.emoji} ${p.nombre}</span>
            <strong>${p.stock} unidades</strong>
        </div>
    `).join('');
}

// ==================== CATEGORÍAS ====================
async function cargarCategorias() {
    try {
        const { data: categorias, error } = await supabaseClient
            .from('categorias')
            .select('*')
            .order('orden');
        
        if (error) throw error;
        
        const tbody = document.getElementById('categoriasTableBody');
        
        if (!categorias || categorias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay categorías registradas</td></tr>';
            return;
        }
        
        tbody.innerHTML = categorias.map(c => `
            <tr>
                <td>${c.orden}</td>
                <td style="font-size: 24px;">${c.emoji}</td>
                <td><strong>${c.nombre}</strong></td>
                <td><code>${c.slug}</code></td>
                <td>${c.descripcion || '-'}</td>
                <td>
                    <span style="display: inline-block; width: 30px; height: 30px; background: ${c.color}; border-radius: 4px; vertical-align: middle;"></span>
                </td>
                <td>
                    <span class="badge ${c.activa ? 'badge-success' : 'badge-danger'}">
                        ${c.activa ? 'Activa' : 'Inactiva'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-edit" onclick="editarCategoria(${c.id})">✏️</button>
                    <button class="btn btn-sm btn-delete" onclick="eliminarCategoria(${c.id})">🗑️</button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando categorías:', error);
        mostrarNotificacion('Error cargando categorías', 'error');
    }
}

function abrirModalCategoria(id = null) {
    document.getElementById('categoriaModalTitle').textContent = id ? 'Editar Categoría' : 'Nueva Categoría';
    document.getElementById('categoriaForm').reset();
    document.getElementById('categoriaId').value = id || '';
    
    if (id) {
        // Cargar datos para editar
        supabaseClient.from('categorias').select('*').eq('id', id).single()
            .then(({ data }) => {
                if (data) {
                    document.getElementById('catNombre').value = data.nombre;
                    document.getElementById('catSlug').value = data.slug;
                    document.getElementById('catDescripcion').value = data.descripcion || '';
                    document.getElementById('catEmoji').value = data.emoji;
                    document.getElementById('catColor').value = data.color;
                    document.getElementById('catOrden').value = data.orden;
                    document.getElementById('catActiva').checked = data.activa;
                }
            });
    }
    
    document.getElementById('categoriaModal').classList.add('show');
}

function cerrarModalCategoria() {
    document.getElementById('categoriaModal').classList.remove('show');
}

async function guardarCategoria(event) {
    event.preventDefault();
    
    const id = document.getElementById('categoriaId').value;
    const emojiInput = document.getElementById('catEmoji').value.trim();
    
    const categoria = {
        nombre: document.getElementById('catNombre').value,
        slug: document.getElementById('catSlug').value.toLowerCase().replace(/\s+/g, '-'),
        descripcion: document.getElementById('catDescripcion').value,
        emoji: emojiInput || '📦',
        color: document.getElementById('catColor').value,
        orden: parseInt(document.getElementById('catOrden').value),
        activa: document.getElementById('catActiva').checked
    };
    
    try {
        let error;
        if (id) {
            ({ error } = await supabaseClient.from('categorias').update(categoria).eq('id', id));
        } else {
            ({ error } = await supabaseClient.from('categorias').insert(categoria));
        }
        
        if (error) throw error;
        
        mostrarNotificacion(`Categoría ${id ? 'actualizada' : 'creada'} exitosamente`);
        cerrarModalCategoria();
        cargarCategorias();
        
    } catch (error) {
        console.error('Error guardando categoría:', error);
        mostrarNotificacion('Error al guardar categoría', 'error');
    }
}

async function editarCategoria(id) {
    abrirModalCategoria(id);
}

async function eliminarCategoria(id) {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) return;
    
    try {
        const { error } = await supabaseClient.from('categorias').delete().eq('id', id);
        if (error) throw error;
        
        mostrarNotificacion('Categoría eliminada');
        cargarCategorias();
    } catch (error) {
        console.error('Error eliminando categoría:', error);
        mostrarNotificacion('Error al eliminar', 'error');
    }
}

// ==================== HORARIOS ====================
let horariosData = [];

async function cargarHorarios() {
    try {
        const { data: horarios, error } = await supabaseClient
            .from('horarios')
            .select('*')
            .order('dia_semana');
        
        if (error) throw error;
        horariosData = horarios || [];
        
        const container = document.getElementById('horariosList');
        const diasNombre = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        
        container.innerHTML = diasNombre.map((dia, index) => {
            const horario = horarios?.find(h => h.dia_semana === index);
            return `
                <div class="horario-item" data-dia="${index}">
                    <div class="horario-dia">${dia}</div>
                    <div class="horario-switch">
                        <input type="checkbox" id="horaAbierto_${index}" 
                            ${horario?.abierto ? 'checked' : ''} 
                            onchange="toggleHorario(${index})">
                        <label for="horaAbierto_${index}">${horario?.abierto ? 'Abierto' : 'Cerrado'}</label>
                    </div>
                    <div class="horario-horas" id="horasContainer_${index}" 
                        style="opacity: ${horario?.abierto ? '1' : '0.5'}; pointer-events: ${horario?.abierto ? 'auto' : 'none'};">
                        <input type="time" id="horaApertura_${index}" value="${horario?.hora_apertura || '10:00'}">
                        <span>a</span>
                        <input type="time" id="horaCierre_${index}" value="${horario?.hora_cierre || '22:00'}">
                        <button class="btn btn-sm btn-primary" onclick="guardarHorario(${index})">💾</button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando horarios:', error);
        mostrarNotificacion('Error cargando horarios', 'error');
    }
}

function toggleHorario(dia) {
    const abierto = document.getElementById(`horaAbierto_${dia}`).checked;
    const container = document.getElementById(`horasContainer_${dia}`);
    container.style.opacity = abierto ? '1' : '0.5';
    container.style.pointerEvents = abierto ? 'auto' : 'none';
    document.querySelector(`label[for="horaAbierto_${dia}"]`).textContent = abierto ? 'Abierto' : 'Cerrado';
}

async function guardarHorario(dia) {
    const diasNombre = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const horario = {
        dia_semana: dia,
        nombre_dia: diasNombre[dia],
        abierto: document.getElementById(`horaAbierto_${dia}`).checked,
        hora_apertura: document.getElementById(`horaApertura_${dia}`).value,
        hora_cierre: document.getElementById(`horaCierre_${dia}`).value
    };
    
    try {
        const { error } = await supabaseClient
            .from('horarios')
            .upsert(horario, { onConflict: 'dia_semana' });
        
        if (error) throw error;
        mostrarNotificacion(`Horario de ${horario.nombre_dia} guardado`);
    } catch (error) {
        console.error('Error guardando horario:', error);
        mostrarNotificacion('Error al guardar horario', 'error');
    }
}

// ==================== UBICACIÓN ====================
async function cargarUbicacion() {
    try {
        const { data: ubicacion, error } = await supabaseClient
            .from('ubicacion')
            .select('*')
            .eq('activo', true)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
        
        if (ubicacion) {
            document.getElementById('ubiNombre').value = ubicacion.nombre_negocio || '';
            document.getElementById('ubiCiudad').value = ubicacion.ciudad || '';
            document.getElementById('ubiDireccion').value = ubicacion.direccion || '';
            document.getElementById('ubiTelefono').value = ubicacion.telefono || '';
            document.getElementById('ubiWhatsapp').value = ubicacion.whatsapp || '';
            document.getElementById('ubiEmail').value = ubicacion.email || '';
            document.getElementById('ubiLatitud').value = ubicacion.latitud || '';
            document.getElementById('ubiLongitud').value = ubicacion.longitud || '';
            document.getElementById('ubiMapa').value = ubicacion.mapa_embed || '';
        }
    } catch (error) {
        console.error('Error cargando ubicación:', error);
    }
}

async function guardarUbicacion(event) {
    event.preventDefault();
    
    const ubicacion = {
        nombre_negocio: document.getElementById('ubiNombre').value,
        ciudad: document.getElementById('ubiCiudad').value,
        direccion: document.getElementById('ubiDireccion').value,
        telefono: document.getElementById('ubiTelefono').value,
        whatsapp: document.getElementById('ubiWhatsapp').value,
        email: document.getElementById('ubiEmail').value,
        latitud: document.getElementById('ubiLatitud').value || null,
        longitud: document.getElementById('ubiLongitud').value || null,
        mapa_embed: document.getElementById('ubiMapa').value,
        activo: true
    };
    
    try {
        // Primero desactivar otras ubicaciones
        await supabaseClient.from('ubicacion').update({ activo: false }).eq('activo', true);
        
        // Insertar nueva
        const { error } = await supabaseClient.from('ubicacion').insert(ubicacion);
        if (error) throw error;
        
        mostrarNotificacion('Ubicación guardada exitosamente');
    } catch (error) {
        console.error('Error guardando ubicación:', error);
        mostrarNotificacion('Error al guardar ubicación', 'error');
    }
}

// ==================== PEDIDOS ====================
async function cargarPedidos(filtroEstado = '', filtroFecha = '') {
    try {
        let query = supabaseClient
            .from('pedidos')
            .select('*')
            .order('creado_en', { ascending: false });
        
        if (filtroEstado) query = query.eq('estado', filtroEstado);
        if (filtroFecha) {
            const inicio = filtroFecha + 'T00:00:00';
            const fin = filtroFecha + 'T23:59:59';
            query = query.gte('creado_en', inicio).lt('creado_en', fin);
        }
        
        const { data: pedidos, error } = await query;
        if (error) throw error;
        
        const tbody = document.getElementById('pedidosTableBody');
        
        if (!pedidos || pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay pedidos registrados</td></tr>';
            return;
        }
        
        tbody.innerHTML = pedidos.map(p => `
            <tr>
                <td><strong>#${p.numero_pedido}</strong></td>
                <td>${new Date(p.creado_en).toLocaleDateString()}</td>
                <td>${p.cliente_nombre}</td>
                <td>${p.cliente_telefono}</td>
                <td><strong>$${formatearPrecio(p.total)}</strong></td>
                <td><span class="estado-badge estado-${p.estado}">${p.estado}</span></td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="verPedido('${p.id}')">👁️</button>
                    <select class="filter-select" onchange="cambiarEstadoPedido('${p.id}', this.value)" style="width: auto; display: inline-block;">
                        <option value="">Cambiar estado</option>
                        <option value="pendiente" ${p.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="preparando" ${p.estado === 'preparando' ? 'selected' : ''}>Preparando</option>
                        <option value="listo" ${p.estado === 'listo' ? 'selected' : ''}>Listo</option>
                        <option value="entregado" ${p.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
                        <option value="cancelado" ${p.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando pedidos:', error);
    }
}

function filtrarPedidos() {
    const estado = document.getElementById('filtroEstadoPedido').value;
    const fecha = document.getElementById('filtroFechaPedido').value;
    cargarPedidos(estado, fecha);
}

async function verPedido(id) {
    try {
        const { data: pedido, error } = await supabaseClient
            .from('pedidos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        document.getElementById('pedidoNumero').textContent = `#${pedido.numero_pedido}`;
        
        const items = pedido.items.map(item => `
            <div class="pedido-item">
                <span>${item.nombre} x${item.cantidad}</span>
                <span>$${formatearPrecio(item.precio * item.cantidad)}</span>
            </div>
        `).join('');
        
        document.getElementById('pedidoDetalle').innerHTML = `
            <div class="pedido-info">
                <div class="pedido-info-row"><strong>Cliente:</strong> <span>${pedido.cliente_nombre}</span></div>
                <div class="pedido-info-row"><strong>Teléfono:</strong> <span>${pedido.cliente_telefono}</span></div>
                <div class="pedido-info-row"><strong>Dirección:</strong> <span>${pedido.cliente_direccion}</span></div>
                <div class="pedido-info-row"><strong>Notas:</strong> <span>${pedido.cliente_notas || 'N/A'}</span></div>
                <div class="pedido-info-row"><strong>Fecha:</strong> <span>${new Date(pedido.creado_en).toLocaleString()}</span></div>
                <div class="pedido-info-row"><strong>Estado:</strong> <span class="estado-badge estado-${pedido.estado}">${pedido.estado}</span></div>
            </div>
            <div class="pedido-items">
                <h4>Items del Pedido</h4>
                ${items}
            </div>
            <div class="pedido-total">Total: $${formatearPrecio(pedido.total)}</div>
            <div class="pedido-acciones">
                <button class="btn btn-primary" onclick="imprimirPedido('${pedido.id}')">🖨️ Imprimir</button>
                <button class="btn btn-success" onclick="whatsappPedido('${pedido.id}')">📱 WhatsApp</button>
            </div>
        `;
        
        document.getElementById('pedidoModal').classList.add('show');
    } catch (error) {
        console.error('Error cargando pedido:', error);
    }
}

function cerrarModalPedido() {
    document.getElementById('pedidoModal').classList.remove('show');
}

async function cambiarEstadoPedido(id, nuevoEstado) {
    if (!nuevoEstado) return;
    
    try {
        const { error } = await supabaseClient
            .from('pedidos')
            .update({ estado: nuevoEstado, actualizado_en: new Date().toISOString() })
            .eq('id', id);
        
        if (error) throw error;
        mostrarNotificacion('Estado actualizado');
        filtrarPedidos();
    } catch (error) {
        mostrarNotificacion('Error al actualizar estado', 'error');
    }
}

// ==================== CONFIGURACIÓN ====================
async function cargarConfiguracion() {
    try {
        const { data: config, error } = await supabaseClient
            .from('configuracion')
            .select('*');
        
        if (error) throw error;
        
        const conf = {};
        config?.forEach(c => conf[c.clave] = c.valor);
        
        document.getElementById('confNombreApp').value = conf.nombre_app || 'AZADOS K';
        document.getElementById('confMoneda').value = conf.moneda || 'COP';
        document.getElementById('confMensaje').value = conf.mensaje_bienvenida || '';
        document.getElementById('confPedidoMinimo').value = conf.pedido_minimo || 15000;
        document.getElementById('confCostoEnvio').value = conf.costo_envio || 5000;
        document.getElementById('confEnvioGratis').value = conf.envio_gratis_min || 50000;
        document.getElementById('confImpuesto').value = conf.impuesto || 0;
        document.getElementById('confTiempoPrep').value = conf.tiempo_preparacion || 30;
        document.getElementById('confMostrarStock').checked = conf.mostrar_stock === 'true';
        document.getElementById('confPermitirPedidos').checked = conf.permitir_pedidos === 'true';
        document.getElementById('confTerminos').value = conf.terminos_condiciones || '';
        
        // Guardar clave actual en memoria para referencia
        window.adminAccessKeyActual = conf.admin_access_key || '';
        
    } catch (error) {
        console.error('Error cargando configuración:', error);
    }
}

// ==================== SEGURIDAD - CLAVE DE ACCESO ====================
async function mostrarClaveActual() {
    const display = document.getElementById('claveActualDisplay');
    
    if (!display.classList.contains('clave-display-hidden')) {
        display.classList.add('clave-display-hidden');
        return;
    }
    
    // Pedir confirmación por seguridad
    if (!confirm('¿Estás seguro de que deseas ver la clave de acceso actual?\n\nEsta información es sensible.')) {
        return;
    }
    
    try {
        // Obtener clave desde Supabase
        const { data, error } = await supabaseClient
            .from('configuracion')
            .select('valor')
            .eq('clave', 'admin_access_key')
            .single();
        
        if (error) throw error;
        
        const clave = data?.valor || 'No configurada';
        display.innerHTML = `<strong>Clave actual:</strong> <code style="font-size: 16px; background: #fff; padding: 5px 10px; border-radius: 4px;">${clave}</code>`;
        display.classList.remove('clave-display-hidden');
        
        // Ocultar automáticamente después de 10 segundos
        setTimeout(() => {
            display.classList.add('clave-display-hidden');
        }, 10000);
        
    } catch (error) {
        console.error('Error obteniendo clave:', error);
        display.innerHTML = '<span style="color: #dc3545;">Error al obtener clave</span>';
        display.classList.remove('clave-display-hidden');
    }
}

async function guardarClaveAdmin() {
    const nuevaClave = document.getElementById('confAdminClave').value.trim();
    
    if (!nuevaClave) {
        return; // No hay cambios, no hacer nada
    }
    
    // Validar longitud mínima
    if (nuevaClave.length < 6) {
        mostrarNotificacion('La clave debe tener al menos 6 caracteres', 'error');
        return false;
    }
    
    try {
        const { error } = await supabaseClient
            .from('configuracion')
            .upsert({ 
                clave: 'admin_access_key', 
                valor: nuevaClave,
                tipo: 'texto',
                descripcion: 'Clave de acceso al panel administrativo'
            }, { onConflict: 'clave' });
        
        if (error) throw error;
        
        mostrarNotificacion('Clave de acceso actualizada correctamente');
        document.getElementById('confAdminClave').value = ''; // Limpiar campo
        document.getElementById('claveActualDisplay').classList.add('clave-display-hidden');
        return true;
        
    } catch (error) {
        console.error('Error guardando clave:', error);
        mostrarNotificacion('Error al guardar la clave de acceso', 'error');
        return false;
    }
}

async function guardarConfiguracion(event) {
    event.preventDefault();
    
    const configs = [
        { clave: 'nombre_app', valor: document.getElementById('confNombreApp').value },
        { clave: 'moneda', valor: document.getElementById('confMoneda').value },
        { clave: 'mensaje_bienvenida', valor: document.getElementById('confMensaje').value },
        { clave: 'pedido_minimo', valor: document.getElementById('confPedidoMinimo').value },
        { clave: 'costo_envio', valor: document.getElementById('confCostoEnvio').value },
        { clave: 'envio_gratis_min', valor: document.getElementById('confEnvioGratis').value },
        { clave: 'impuesto', valor: document.getElementById('confImpuesto').value },
        { clave: 'tiempo_preparacion', valor: document.getElementById('confTiempoPrep').value },
        { clave: 'mostrar_stock', valor: document.getElementById('confMostrarStock').checked.toString() },
        { clave: 'permitir_pedidos', valor: document.getElementById('confPermitirPedidos').checked.toString() },
        { clave: 'terminos_condiciones', valor: document.getElementById('confTerminos').value }
    ];
    
    try {
        for (const config of configs) {
            await supabaseClient.from('configuracion').upsert(config, { onConflict: 'clave' });
        }
        
        // Guardar clave de admin si se ingresó una nueva
        const nuevaClave = document.getElementById('confAdminClave').value.trim();
        if (nuevaClave) {
            const claveGuardada = await guardarClaveAdmin();
            if (!claveGuardada) return; // Error al guardar clave
        }
        
        mostrarNotificacion('Configuración guardada exitosamente');
    } catch (error) {
        console.error('Error guardando configuración:', error);
        mostrarNotificacion('Error al guardar configuración', 'error');
    }
}

// ==================== ACTUALIZAR CAMBIAR SECCIÓN ====================
// Sobrescribir función existente para incluir nuevas secciones
const cambiarSeccionOriginal = cambiarSeccion;
cambiarSeccion = function(seccion) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    // Mostrar sección seleccionada
    const seccionMap = {
        'dashboard': 'dashboardSection',
        'productos': 'productosSection',
        'agregar': 'agregarSection',
        'estadisticas': 'estadisticasSection',
        'categorias': 'categoriasSection',
        'horarios': 'horariosSection',
        'ubicacion': 'ubicacionSection',
        'pedidos': 'pedidosSection',
        'configuracion': 'configuracionSection'
    };
    
    const sectionId = seccionMap[seccion];
    if (sectionId) {
        document.getElementById(sectionId).classList.add('active');
    }
    
    // Activar botón correspondiente
    const navBtnIndex = Object.keys(seccionMap).indexOf(seccion);
    if (navBtnIndex >= 0) {
        document.querySelectorAll('.nav-btn')[navBtnIndex]?.classList.add('active');
    }
    
    // Cargar datos específicos de la sección
    if (seccion === 'dashboard') cargarDashboard();
    if (seccion === 'categorias') cargarCategorias();
    if (seccion === 'horarios') cargarHorarios();
    if (seccion === 'ubicacion') cargarUbicacion();
    if (seccion === 'pedidos') cargarPedidos();
    if (seccion === 'configuracion') cargarConfiguracion();
};

// ==================== BADGES ADICIONALES ====================
// Agregar estilos CSS para badges
const style = document.createElement('style');
style.textContent = `
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    .text-center { text-align: center; }
`;
document.head.appendChild(style);
