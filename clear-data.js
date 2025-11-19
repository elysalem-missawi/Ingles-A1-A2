// Script para limpiar datos antiguos en árabe del localStorage
// Ejecuta este script una vez para limpiar datos antiguos

(function() {
    console.log('Limpiando datos antiguos del localStorage...');
    
    // Limpiar el progreso antiguo
    localStorage.removeItem('memoryAppProgress');
    
    console.log('✅ Datos limpiados. Recarga la página para empezar de nuevo.');
    alert('Datos antiguos eliminados. La aplicación se reiniciará en español.');
    location.reload();
})();
