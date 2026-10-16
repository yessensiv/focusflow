/* Startup: initialization hooks precede the first render. */
document.addEventListener('DOMContentLoaded',()=>{FF.emit('init');FF.bootUI();});
