'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    particlesJS: any
    pJSDom: any[]
  }
}

export function ParticlesBackground() {
  useEffect(() => {
    // Load particles.js script
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js'
    script.async = true
    
    script.onload = () => {
      if (window.particlesJS) {
        window.particlesJS("particles-js", {
          "particles": {
            "number": {
              "value": 355,
              "density": {
                "enable": true,
                "value_area": 789.1476416322727
              }
            },
            "color": {
              "value": "#D490AF"
            },
            "shape": {
              "type": "circle",
              "stroke": {
                "width": 0,
                "color": "#000000"
              },
              "polygon": {
                "nb_sides": 5
              }
            },
            "opacity": {
              "value": 0.48927153781200905,
              "random": false,
              "anim": {
                "enable": true,
                "speed": 0.2,
                "opacity_min": 0,
                "sync": false
              }
            },
            "size": {
              "value": 2,
              "random": true,
              "anim": {
                "enable": true,
                "speed": 2,
                "size_min": 0,
                "sync": false
              }
            },
            "line_linked": {
              "enable": false,
              "distance": 150,
              "color": "#ffffff",
              "opacity": 0.4,
              "width": 1
            },
            "move": {
              "enable": true,
              "speed": 0.2,
              "direction": "none",
              "random": true,
              "straight": false,
              "out_mode": "out",
              "bounce": false,
              "attract": {
                "enable": false,
                "rotateX": 600,
                "rotateY": 1200
              }
            }
          },
          "interactivity": {
            "detect_on": "canvas",
            "events": {
              "onhover": {
                "enable": true,
                "mode": "bubble"
              },
              "onclick": {
                "enable": true,
                "mode": "push"
              },
              "resize": true
            },
            "modes": {
              "grab": {
                "distance": 400,
                "line_linked": {
                  "opacity": 1
                }
              },
              "bubble": {
                "distance": 83.91608391608392,
                "size": 1,
                "duration": 3,
                "opacity": 1,
                "speed": 3
              },
              "repulse": {
                "distance": 200,
                "duration": 0.4
              },
              "push": {
                "particles_nb": 4
              },
              "remove": {
                "particles_nb": 2
              }
            }
          },
          "retina_detect": true
        })
      }
    }
    
    document.body.appendChild(script)
    
    return () => {
      // Cleanup
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  return (
    <>
      <div id="particles-js" className="fixed inset-0 -z-10" />
      <style jsx global>{`
        #particles-js {
          position: fixed;
          width: 100%;
          height: 100%;
          background: radial-gradient(ellipse at top, #190f3d 0%, #080514 100%);
          z-index: -1;
        }
        canvas {
          display: block;
          vertical-align: bottom;
        }
      `}</style>
    </>
  )
}

