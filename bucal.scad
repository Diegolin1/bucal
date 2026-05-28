// =====================================================================
// BUCAL PRO - Modelo Paramétrico 3D para Manufactura (Blank)
// Diseño Doble Densidad (Estilo ADX)
// =====================================================================

/* [Dimensiones Generales del Arco] */
// Distancia exterior de molar a molar
arch_width = 64; 
// Distancia desde incisivos hasta molares
arch_depth = 40; 

/* [Grosor y Altura de Paredes] */
// Grosor de la pared vestibular (frente)
wall_thickness_front = 6.0; 
// Grosor de la pared vestibular (molares)
wall_thickness_molar = 4.0; 
// Altura frontal del bucal (encía superior)
height_front = 16.0; 

/* [Canal y Pared Palatina (Interna)] */
channel_width = 10.0; 
palatal_thickness = 4.5;
palatal_height = 15.0; // Pared palatina ALTA
occlusal_thickness = 3.0; // Grosor de base (suelo bajo -> canal PROFUNDO)

/* [Visualización y Exportación] */
// Selecciona qué parte generar (0 = Ambas, 1 = Solo Carcasa Negra, 2 = Solo Gel Interno)
parte_a_exportar = 0; 
// Calidad de la malla (usa 60-100 para STL final)
$fn = 60; 

// =====================================================================
// EJECUCIÓN PRINCIPAL
// =====================================================================

if (parte_a_exportar == 0) {
    union() {
        color("#ff1493") carcasa_externa();
        color("#ffb6c1") gel_interno();
    }
} else if (parte_a_exportar == 1) {
    carcasa_externa();
} else if (parte_a_exportar == 2) {
    gel_interno();
}

// =====================================================================
// MÓDULOS DEL BUCAL (DOBLE DENSIDAD)
// =====================================================================

module carcasa_externa() {
    difference() {
        arch_sweep_dynamic(steps = $fn, layer = 0);
    }
}

module gel_interno() {
    difference() {
        arch_sweep_dynamic(steps = $fn, layer = 1);
        escaneo_dental();
    }
}

// =====================================================================
// MATEMÁTICAS DE GENERACIÓN Y SWEEP (BARRIDO)
// =====================================================================

module profile_outer(w_lab, w_pal, w_ch, h_lab, h_pal, h_occ) {
    out_t = 2.0; // Grosor de la carcasa externa
    
    offset(r=4.0, $fn=24) // Esquinas inferiores masivas (Líneas azules)
    polygon([
        [w_lab, h_lab - 1.5],
        [w_lab, -h_occ],
        [-w_ch - w_pal, -h_occ],
        [-w_ch - w_pal, h_pal - 1.5],
        [-w_ch - w_pal + out_t, h_pal - 1.5],
        [-w_ch - w_pal + out_t, -h_occ + out_t],
        [w_lab - out_t, -h_occ + out_t],
        [w_lab - out_t, h_lab - 1.5]
    ]);
}

module profile_inner(w_lab, w_pal, w_ch, h_lab, h_pal, h_occ) {
    out_t = 2.0;
    floor_y = -h_occ + 3.0; // Suelo muy bajo = Canal profundo
    
    offset(r=2.0, $fn=16)
    polygon([
        [w_lab + 0.5, h_lab - 1.5],
        [w_lab + 0.5, h_lab - 1.0],
        [w_lab - 1.0, h_lab],
        [0, h_lab],
        
        [0, floor_y + 4.0], // Caída vertical profunda
        [-w_ch/2, floor_y], // Fondo de la U profunda
        [-w_ch, floor_y + 4.0], // Subida vertical profunda
        
        [-w_ch, h_pal],
        [-w_ch - w_pal + 0.5, h_pal],
        [-w_ch - w_pal - 0.5, h_pal - 0.5],
        [-w_ch - w_pal - 0.5, h_pal - 1.5],
        
        [-w_ch - w_pal + out_t, h_pal - 1.5],
        [-w_ch - w_pal + out_t, -h_occ + out_t],
        [w_lab - out_t, -h_occ + out_t],
        [w_lab - out_t, h_lab - 1.5]
    ]);
}

// Genera el perfil 2D dinámicamente según la posición (t = 0 a 180 grados)
module profile_dynamic(t, layer) {
    df = abs(t - 90) / 90; 
    
    w_lab = wall_thickness_front * (1 - df) + wall_thickness_molar * df;
    w_pal = palatal_thickness;
    w_ch  = channel_width;
    h_occ = occlusal_thickness;
    
    // Perfil decreciente hacia los molares (Taper)
    taper = (t < 45) ? (0.65 + 0.35 * t / 45) : ((t > 135) ? (0.65 + 0.35 * (180 - t) / 45) : 1.0);
    
    // Escotadura Frontal (Frenulum Notch) - Ancha y Suave
    dist_front = abs(t - 90);
    notch_depth = (dist_front < 35) ? (4.5 * exp(-pow(dist_front, 2)/150)) : 0; // Más ancha (150)
    
    h_lab = (height_front - notch_depth) * taper;
    h_pal = (palatal_height - notch_depth * 0.6) * taper;
    
    if (layer == 0) {
        profile_outer(w_lab, w_pal, w_ch, h_lab, h_pal, h_occ);
    } else {
        profile_inner(w_lab, w_pal, w_ch, h_lab, h_pal, h_occ);
    }
}

// Posiciona un perfil 2D en el espacio 3D siguiendo la curva anatómica (Parábola 2.2)
module place_profile(t, w, d) {
    nx_val = (t - 90) / 90;
    x = (w / 2) * nx_val;
    y = -d * pow(abs(nx_val), 2.2);
    
    delta = 0.1;
    nx_val_next = (t + delta - 90) / 90;
    x_next = (w / 2) * nx_val_next;
    y_next = -d * pow(abs(nx_val_next), 2.2);
    
    dx = x_next - x;
    dy = y_next - y;
    norm_angle = atan2(dy, dx) - 90;
    
    translate([x, y, 0])
    rotate([0, 0, norm_angle])
    rotate([90, 0, 0])
    linear_extrude(height=0.1, center=true)
    children();
}

// Realiza el barrido uniendo cortes consecutivos
module arch_sweep_dynamic(steps, layer) {
    w = arch_width;
    d = arch_depth;
    
    for (i = [0 : steps - 1]) {
        t1 = (i / steps) * 180;
        t2 = ((i + 1) / steps) * 180;
        
        hull() {
            place_profile(t1, w, d) profile_dynamic(t1, layer);
            place_profile(t2, w, d) profile_dynamic(t2, layer);
        }
    }
}

// =====================================================================
// OPERACIÓN BOOLEANA (CANAL INTERNO DENTAL)
// =====================================================================

module escaneo_dental() {
    // INSTRUCCIÓN PARA PRODUCCIÓN REAL:
    // import("scan.stl");
    
    // MOCKUP PARA DEMOSTRACIÓN:
    color("#e0e0e0")
    arch_sweep_teeth(steps = $fn);
}

module arch_sweep_teeth(steps) {
    a = arch_width / 2;
    b = arch_depth;
    for (i = [0 : steps - 1]) {
        t1 = (i / steps) * 180;
        t2 = ((i + 1) / steps) * 180;
        hull() {
            place_profile(t1, a, b) teeth_profile(t1);
            place_profile(t2, a, b) teeth_profile(t2);
        }
    }
}

module teeth_profile(t) {
    w_ch = channel_width;
    df = abs(t - 90) / 90; 
    h_lab = height_front * (1 - df) + 10.0 * df;
    
    polygon([
        [-w_ch + 0.1, h_lab + 5],
        [-0.1, h_lab + 5],
        [-0.1, 0.5],
        [-w_ch + 0.1, 0.5]
    ]);
}
