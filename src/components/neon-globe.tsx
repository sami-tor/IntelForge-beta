'use client'

import { useEffect, useRef } from 'react'

export function NeonGlobe() {
  const containerRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Check for WebGL support
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      console.warn('WebGL not supported, skipping globe')
      return
    }

    // Store original console methods BEFORE anything else
    const originalWarn = console.warn.bind(console)
    
    // Suppress THREE.js deprecation warnings immediately
    const suppressThreeWarnings = (...args: any[]) => {
      const message = args.join(' ')
      // Suppress the useLegacyLights deprecation warning from globe.gl
      if (
        message.includes('useLegacyLights') || 
        message.includes('THREE.WebGLRenderer') ||
        message.includes('.useLegacyLights has been deprecated')
      ) {
        return // Suppress this specific warning
      }
      originalWarn(...args)
    }
    
    // Apply suppression immediately
    console.warn = suppressThreeWarnings

    // Lazy load globe.gl
    const loadGlobe = async () => {
      try {
        // SECURITY: globe.gl already includes Three.js, so we don't load it separately
        // This prevents the "Multiple instances of Three.js" warning
        
        // Check if globe.gl is already loaded
        if ((window as any).Globe) {
          // Globe is already loaded, proceed with initialization
          initializeGlobe()
          return
        }

        // Check if script is already being loaded or exists
        const existingScript = document.getElementById('globe-gl-script')
        if (existingScript) {
          // Script exists, wait for it to load
          await new Promise((resolve) => {
            if ((window as any).Globe) {
              resolve(undefined)
            } else {
              existingScript.addEventListener('load', () => resolve(undefined))
              // Timeout after 5 seconds
              setTimeout(() => resolve(undefined), 5000)
            }
          })
          
          if ((window as any).Globe) {
            initializeGlobe()
          }
          return
        }
        
        // Load globe.gl (it includes Three.js internally)
        const globeScript = document.createElement('script')
        globeScript.src = 'https://cdn.jsdelivr.net/npm/globe.gl@2.29.0/dist/globe.gl.min.js'
        globeScript.id = 'globe-gl-script' // Add ID to prevent duplicate loading
        
        await new Promise((resolve, reject) => {
          globeScript.onload = () => {
            // Wait a bit for Globe to be available
            setTimeout(() => {
              if ((window as any).Globe) {
                resolve(undefined)
              } else {
                reject(new Error('Globe.gl not available after load'))
              }
            }, 100)
          }
          globeScript.onerror = reject
          document.head.appendChild(globeScript)
        })

        if (!(window as any).Globe) {
          console.error('Globe.gl not loaded')
          return
        }

        initializeGlobe()
      } catch (error) {
        console.error('Failed to load globe:', error)
      }
    }
    
    // Cleanup function to restore console.warn
    const cleanup = () => {
      console.warn = originalWarn
    }

    const initializeGlobe = () => {
      if (!containerRef.current) return
      
      const Globe = (window as any).Globe

      if (!Globe) {
        console.error('Globe.gl not loaded')
        return
      }

      // Configuration
      const config = {
        colors: {
          dots: '#ef4444', // Red color
          glow: '#ef4444', // Red glow
          background: '#0d1513'
        },
        autoRotateSpeed: 0.5, // degrees per second
        size: 600
      }

      // Create globe with black sphere
      const globe = Globe()(containerRef.current!)
        .backgroundColor(config.colors.background)
        .showAtmosphere(true)
        .atmosphereColor('#ef4444') // Red atmosphere
        .atmosphereAltitude(0.15)
        .globeMaterial({
          color: '#000000',
          emissive: '#1a0000', // Slight red emissive
          emissiveIntensity: 0.1
        })

      // Add continent dots - evenly spaced dots forming continents
      const continentData = [
        // North America - East Coast
        ...Array.from({ length: 30 }, (_, i) => ({
          lat: 25 + (i * 2),
          lng: -100 + (i % 3) * 10,
          size: 0.4
        })),
        // North America - West Coast
        ...Array.from({ length: 20 }, (_, i) => ({
          lat: 32 + (i * 1.5),
          lng: -120 + (i % 2) * 5,
          size: 0.4
        })),
        // Europe
        ...Array.from({ length: 25 }, (_, i) => ({
          lat: 45 + (i * 1.2),
          lng: -5 + (i % 4) * 8,
          size: 0.4
        })),
        // Asia
        ...Array.from({ length: 40 }, (_, i) => ({
          lat: 20 + (i * 2),
          lng: 80 + (i % 5) * 10,
          size: 0.4
        })),
        // South America
        ...Array.from({ length: 20 }, (_, i) => ({
          lat: -35 + (i * 2),
          lng: -60 + (i % 3) * 8,
          size: 0.4
        })),
        // Africa
        ...Array.from({ length: 30 }, (_, i) => ({
          lat: -10 + (i * 1.5),
          lng: 15 + (i % 4) * 10,
          size: 0.4
        })),
        // Australia
        ...Array.from({ length: 15 }, (_, i) => ({
          lat: -25 + (i * 1),
          lng: 130 + (i % 3) * 5,
          size: 0.4
        }))
      ]

      globe
        .pointsData(continentData)
        .pointColor(() => config.colors.dots)
        .pointAltitude(0.01)
        .pointRadius(0.8)
        .pointLabel(() => '')
        .pointsMerge(false)

      // Add pulsing markers for major cities
      const cityMarkers = [
        { lat: 40.7128, lng: -74.0060, name: 'NYC' },
        { lat: 51.5074, lng: -0.1278, name: 'London' },
        { lat: 1.3521, lng: 103.8198, name: 'Singapore' }
      ]

      // Add pulsing markers for cities
      globe
        .labelsData(cityMarkers)
        .labelText(() => '')
        .labelSize(3)
        .labelDotRadius(4)
        .labelDotOrientation(() => 'top')
        .labelColor(() => config.colors.dots)
        .labelResolution(2)
        
      // Animate pulsing markers
      const pulseMarkers = () => {
        cityMarkers.forEach((marker, i) => {
          setTimeout(() => {
            const markerEl = document.querySelector<HTMLElement>(`[data-lat="${marker.lat}"]`)
            if (markerEl) {
              markerEl.style.animation = 'pulse 2s infinite'
            }
          }, i * 500)
        })
      }
      pulseMarkers()

      // Auto-rotate
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReducedMotion) {
        let rotation = 0
        const animate = () => {
          rotation += config.autoRotateSpeed * 0.01
          globe.pointOfView({ lat: 0, lng: rotation, altitude: 2.5 })
          requestAnimationFrame(animate)
        }
        animate()
      }

      // Handle resize
      const handleResize = () => {
        if (containerRef.current) {
          const size = Math.min(640, containerRef.current.offsetWidth)
          globe.width(size).height(size)
        }
      }
      window.addEventListener('resize', handleResize)
      handleResize()

      globeRef.current = globe

      return () => {
        window.removeEventListener('resize', handleResize)
        if (globeRef.current && globeRef.current._destructor) {
          globeRef.current._destructor()
        }
      }
    }

    loadGlobe()
    
    // Restore original console.warn when component unmounts
    return cleanup
  }, [])

  return (
    <>
      <div 
        ref={containerRef}
        id="globe"
        className="mx-auto hidden lg:flex items-center justify-center relative globe-container"
        style={{ 
          width: '100%', 
          height: '100%',
          filter: 'drop-shadow(0 0 40px #ef4444)',
          transition: 'filter 0.3s ease',
          opacity: 0.7
        }}
      />
      <style jsx global>{`
        #globe::before {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(239, 68, 68, 0.1) 0%, transparent 70%);
          pointer-events: none;
          z-index: -1;
          transition: opacity 0.3s ease;
          opacity: 0.6;
        }
        #globe canvas {
          border-radius: 50%;
          pointer-events: none;
        }
        .globe-wrapper:hover #globe {
          filter: drop-shadow(0 0 60px #ef4444) drop-shadow(0 0 100px rgba(239, 68, 68, 0.5)) !important;
          opacity: 0.85 !important;
        }
        .globe-wrapper:hover #globe::before {
          opacity: 0.8;
          background: radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, transparent 70%);
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </>
  )
}

