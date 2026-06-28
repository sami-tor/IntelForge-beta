"use client"

// ================================================
// /api-docs — Swagger UI themed to match IntelForge dark theme
// ================================================
import { useEffect, useState } from "react"
import Logo from "@/components/logo"

export default function ApiDocsPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load Swagger UI CSS
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui.css"
    document.head.appendChild(link)

    // Load Swagger UI JS
    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"
    script.onload = () => {
      // @ts-expect-error SwaggerUIBundle is loaded globally
      window.SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        // @ts-expect-error presets from global
        presets: [window.SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
      })

      // Apply comprehensive dark theme overrides after Swagger loads
      const style = document.createElement("style")
      style.textContent = `
        /* ================================================
           IntelForge Dark Theme for Swagger UI
           ================================================ */
        
        /* Base elements */
        * {
          box-sizing: border-box !important;
        }
        
        body {
          background: #0a0a0a !important;
          margin: 0 !important;
          padding: 0 !important;
          font-family: 'oxanium', -apple-system, BlinkMacSystemFont, sans-serif !important;
        }
        
        .swagger-ui {
          color: #e4e4e7 !important;
        }
        
        .swagger-ui .wrapper {
          max-width: 100% !important;
          padding: 20px 40px !important;
        }
        
        /* Top bar / Header */
        .swagger-ui .topbar {
          background: #141318 !important;
          border-bottom: 1px solid #2c2535 !important;
          padding: 12px 20px !important;
        }
        
        .swagger-ui .topbar-wrapper {
          background: transparent !important;
        }
        
        .swagger-ui .topbar-wrapper .topbar-header {
          display: flex !important;
          align-items: center !important;
          gap: 16px !important;
        }
        
        .swagger-ui .topbar-wrapper .topbar-header .header-title {
          color: #ef4444 !important;
          font-family: 'oxanium', sans-serif !important;
          font-weight: 700 !important;
          font-size: 20px !important;
          letter-spacing: 0.5px !important;
        }
        
        .swagger-ui .topbar-wrapper a {
          color: #ef4444 !important;
        }
        
        /* Info section */
        .swagger-ui .info {
          margin: 30px 0 !important;
        }
        
        .swagger-ui .info .title {
          color: #ef4444 !important;
          font-family: 'oxanium', sans-serif !important;
          font-size: 28px !important;
          font-weight: 700 !important;
        }
        
        .swagger-ui .info .description {
          color: #a1a1aa !important;
          font-size: 14px !important;
          line-height: 1.6 !important;
          margin-top: 10px !important;
        }
        
        .swagger-ui .info .description code {
          background: #141318 !important;
          color: #ef4444 !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }
        
        /* Scheme container (server select, auth) */
        .swagger-ui .scheme-container {
          background: #141318 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 12px !important;
          padding: 20px !important;
          margin-bottom: 30px !important;
          box-shadow: none !important;
        }
        
        .swagger-ui .schemes {
          gap: 16px !important;
        }
        
        .swagger-ui select {
          background: #0f0c12 !important;
          color: #e4e4e7 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          font-family: 'oxanium', sans-serif !important;
          font-size: 13px !important;
        }
        
        .swagger-ui select:hover {
          border-color: #ef4444 !important;
        }
        
        /* Buttons */
        .swagger-ui .btn {
          background: #ef4444 !important;
          border-color: #ef4444 !important;
          border-radius: 8px !important;
          font-family: 'oxanium', sans-serif !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          text-transform: none !important;
          padding: 8px 16px !important;
          box-shadow: none !important;
          transition: all 0.2s !important;
        }
        
        .swagger-ui .btn:hover {
          background: #dc2626 !important;
          border-color: #dc2626 !important;
          transform: translateY(-1px) !important;
        }
        
        .swagger-ui .btn.execute {
          background: #ef4444 !important;
          border: 1px solid #ef4444 !important;
        }
        
        .swagger-ui .btn.cancel {
          background: transparent !important;
          border: 1px solid #2c2535 !important;
          color: #a1a1aa !important;
        }
        
        .swagger-ui .btn.cancel:hover {
          border-color: #ef4444 !important;
          color: #ef4444 !important;
          background: transparent !important;
        }
        
        /* Operation blocks */
        .swagger-ui .opblock {
          border: 1px solid #2c2535 !important;
          border-radius: 12px !important;
          margin-bottom: 16px !important;
          background: #141318 !important;
          overflow: hidden !important;
        }
        
        .swagger-ui .opblock:hover {
          border-color: rgba(239, 68, 68, 0.3) !important;
        }
        
        .swagger-ui .opblock .opblock-summary {
          background: #141318 !important;
          padding: 16px 20px !important;
          cursor: pointer !important;
          border-bottom: none !important;
          min-height: auto !important;
        }
        
        .swagger-ui .opblock .opblock-summary:hover {
          background: #1a1520 !important;
        }
        
        .swagger-ui .opblock .opblock-summary .http-method span {
          border-radius: 6px !important;
          padding: 4px 10px !important;
          font-family: 'oxanium', sans-serif !important;
          font-weight: 700 !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
        }
        
        .swagger-ui .opblock .opblock-summary .path {
          color: #e4e4e7 !important;
          font-size: 14px !important;
          font-family: 'Courier New', monospace !important;
        }
        
        .swagger-ui .opblock .opblock-summary .path:hover {
          color: #ef4444 !important;
        }
        
        /* GET method */
        .swagger-ui .opblock-get .opblock-summary {
          border-left: 3px solid #3b82f6 !important;
        }
        
        .swagger-ui .opblock-get .opblock-summary .http-method span {
          background: #3b82f6 !important;
          color: white !important;
        }
        
        /* POST method */
        .swagger-ui .opblock-post .opblock-summary {
          border-left: 3px solid #22c55e !important;
        }
        
        .swagger-ui .opblock-post .opblock-summary .http-method span {
          background: #22c55e !important;
          color: white !important;
        }
        
        /* PUT method */
        .swagger-ui .opblock-put .opblock-summary {
          border-left: 3px solid #eab308 !important;
        }
        
        .swagger-ui .opblock-put .opblock-summary .http-method span {
          background: #eab308 !important;
          color: black !important;
        }
        
        /* DELETE method */
        .swagger-ui .opblock-delete .opblock-summary {
          border-left: 3px solid #ef4444 !important;
        }
        
        .swagger-ui .opblock-delete .opblock-summary .http-method span {
          background: #ef4444 !important;
          color: white !important;
        }
        
        /* PATCH method */
        .swagger-ui .opblock-patch .opblock-summary {
          border-left: 3px solid #a855f7 !important;
        }
        
        .swagger-ui .opblock-patch .opblock-summary .http-method span {
          background: #a855f7 !important;
          color: white !important;
        }
        
        /* Operation content */
        .swagger-ui .opblock-body {
          background: #0f0c12 !important;
          border-top: 1px solid #2c2535 !important;
          padding: 20px !important;
        }
        
        .swagger-ui .opblock-section-header {
          background: #0f0c12 !important;
          border-bottom: 1px solid #2c2535 !important;
          padding: 16px 20px !important;
        }
        
        .swagger-ui .opblock-section-header h4 {
          color: #e4e4e7 !important;
          font-family: 'oxanium', sans-serif !important;
          font-weight: 600 !important;
        }
        
        /* Parameters */
        .swagger-ui .parameters {
          border-bottom: 1px solid #2c2535 !important;
        }
        
        .swagger-ui .param {
          padding: 12px 0 !important;
        }
        
        .swagger-ui .param-header {
          display: none !important;
        }
        
        .swagger-ui .param-name {
          color: #e4e4e7 !important;
          font-weight: 600 !important;
          font-size: 13px !important;
        }
        
        .swagger-ui .param-name.required {
          color: #ef4444 !important;
        }
        
        .swagger-ui .param-type {
          color: #ef4444 !important;
          font-family: 'Courier New', monospace !important;
          font-size: 12px !important;
        }
        
        .swagger-ui input {
          background: #141318 !important;
          color: #e4e4e7 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
          padding: 10px 14px !important;
          font-family: 'Courier New', monospace !important;
          font-size: 13px !important;
        }
        
        .swagger-ui input:focus {
          border-color: #ef4444 !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15) !important;
        }
        
        textarea {
          background: #141318 !important;
          color: #e4e4e7 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
          padding: 10px 14px !important;
          font-family: 'Courier New', monospace !important;
          font-size: 13px !important;
        }
        
        /* Request body editor */
        .swagger-ui .body-editor {
          background: #141318 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
        }
        
        /* Response area */
        .swagger-ui .responses-wrapper {
          border-top: 1px solid #2c2535 !important;
        }
        
        .swagger-ui .response {
          border-bottom: 1px solid #2c2535 !important;
          padding: 16px 0 !important;
        }
        
        .swagger-ui .response:last-child {
          border-bottom: none !important;
        }
        
        .swagger-ui .response-header {
          color: #e4e4e7 !important;
          font-size: 13px !important;
          font-weight: 600 !important;
        }
        
        .swagger-ui .response-col_status {
          font-family: 'oxanium', sans-serif !important;
          font-weight: 700 !important;
          font-size: 13px !important;
        }
        
        /* Tables */
        .swagger-ui table {
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
          overflow: hidden !important;
        }
        
        .swagger-ui table thead {
          background: #0f0c12 !important;
        }
        
        .swagger-ui table thead tr th {
          color: #a1a1aa !important;
          font-weight: 600 !important;
          font-size: 12px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          padding: 12px 16px !important;
          border-bottom: 1px solid #2c2535 !important;
        }
        
        .swagger-ui table tbody tr {
          background: #141318 !important;
        }
        
        .swagger-ui table tbody tr:hover {
          background: #1a1520 !important;
        }
        
        .swagger-ui table tbody tr td {
          color: #a1a1aa !important;
          padding: 12px 16px !important;
          border-bottom: 1px solid #2c2535 !important;
          font-size: 13px !important;
        }
        
        /* Model schemas */
        .swagger-ui .model {
          color: #a1a1aa !important;
        }
        
        .swagger-ui .model-box {
          background: #141318 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
          padding: 16px !important;
        }
        
        .swagger-ui .model-title {
          color: #ef4444 !important;
          font-weight: 600 !important;
          font-size: 13px !important;
        }
        
        .swagger-ui .model-title__text {
          color: #ef4444 !important;
        }
        
        .swagger-ui .model-description {
          color: #a1a1aa !important;
          font-size: 12px !important;
          margin-top: 4px !important;
        }
        
        .swagger-ui .model property {
          color: #a1a1aa !important;
        }
        
        .swagger-ui .model .property-name {
          color: #e4e4e7 !important;
          font-weight: 600 !important;
        }
        
        .swagger-ui .model .property-type {
          color: #ef4444 !important;
          font-family: 'Courier New', monospace !important;
          font-size: 12px !important;
        }
        
        /* Notices and warnings */
        .swagger-ui .notice {
          background: #1a1520 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
          color: #a1a1aa !important;
          padding: 12px 16px !important;
          font-size: 13px !important;
        }
        
        .swagger-ui .version-pragma__message {
          color: #a1a1aa !important;
          font-size: 14px !important;
        }
        
        /* Loading spinner */
        .swagger-ui .loading-container {
          background: #141318 !important;
        }
        
        /* Error states */
        .swagger-ui .errors-wrapper {
          background: rgba(239, 68, 68, 0.1) !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          border-radius: 8px !important;
        }
        
        /* Scrollbar styling */
        .swagger-ui ::-webkit-scrollbar {
          width: 8px !important;
          height: 8px !important;
        }
        
        .swagger-ui ::-webkit-scrollbar-track {
          background: #0f0c12 !important;
        }
        
        .swagger-ui ::-webkit-scrollbar-thumb {
          background: #2c2535 !important;
          border-radius: 4px !important;
        }
        
        .swagger-ui ::-webkit-scrollbar-thumb:hover {
          background: #ef4444 !important;
        }
        
        /* Dropdown menus */
        .swagger-ui .dropbtn {
          background: #141318 !important;
          border: 1px solid #2c2535 !important;
          color: #e4e4e7 !important;
          border-radius: 8px !important;
        }
        
        .swagger-ui .dropdown-content {
          background: #141318 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
        }
        
        .swagger-ui .dropdown-content a {
          color: #e4e4e7 !important;
        }
        
        .swagger-ui .dropdown-content a:hover {
          background: #1a1520 !important;
          color: #ef4444 !important;
        }
        
        /* Try it out section */
        .swagger-ui .try-out__btn {
          background: transparent !important;
          border: 1px solid #2c2535 !important;
          color: #a1a1aa !important;
          border-radius: 6px !important;
          font-family: 'oxanium', sans-serif !important;
          font-size: 12px !important;
          padding: 6px 12px !important;
        }
        
        .swagger-ui .try-out__btn:hover {
          border-color: #ef4444 !important;
          color: #ef4444 !important;
        }
        
        .swagger-ui .try-out__btn.active {
          background: #ef4444 !important;
          border-color: #ef4444 !important;
          color: white !important;
        }
        
        /* Code blocks */
        .swagger-ui code {
          background: #0f0c12 !important;
          color: #ef4444 !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          font-family: 'Courier New', monospace !important;
          font-size: 12px !important;
        }
        
        .swagger-ui pre {
          background: #0f0c12 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
          padding: 16px !important;
        }
        
        .swagger-ui pre code {
          background: transparent !important;
          padding: 0 !important;
        }
        
        /* Highlight box */
        .swagger-ui .highlight-box {
          background: #141318 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
        }
        
        /* Server variables */
        .swagger-ui .server-variables {
          background: #141318 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 8px !important;
          padding: 16px !important;
        }
        
        /* Auth modal */
        .swagger-ui .modal-wrapper {
          background: rgba(0, 0, 0, 0.8) !important;
        }
        
        .swagger-ui .modal-content {
          background: #141318 !important;
          border: 1px solid #2c2535 !important;
          border-radius: 12px !important;
        }
        
        /* Copy button */
        .swagger-ui .copy-to-clipboard {
          background: transparent !important;
          border: 1px solid #2c2535 !important;
          border-radius: 4px !important;
        }
        
        .swagger-ui .copy-to-clipboard:hover {
          background: #ef4444 !important;
          border-color: #ef4444 !important;
        }
        
        /* Collaspe arrow */
        .swagger-ui .opblock-arrow {
          color: #a1a1aa !important;
          font-size: 20px !important;
        }
        
        .swagger-ui .opblock-arrow:hover {
          color: #ef4444 !important;
        }
        
        /* Operation summary description */
        .swagger-ui .opblock-summary-description {
          color: #a1a1aa !important;
          font-size: 13px !important;
        }
        
        /* Parameter description */
        .swagger-ui .param-description {
          color: #a1a1aa !important;
          font-size: 12px !important;
          margin-top: 4px !important;
        }
        
        /* Divider */
        .swagger-ui .divider {
          background: #2c2535 !important;
        }
      `
      document.head.appendChild(style)
      setLoading(false)
    }
    document.body.appendChild(script)

    return () => {
      link.remove()
      script.remove()
    }
  }, [])

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", paddingTop: "60px" }}>
      {/* Page header */}
      <div style={{ 
        background: "linear-gradient(180deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%)",
        borderBottom: "1px solid #2c2535",
        padding: "30px 40px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
          <div style={{ 
            background: "rgba(239, 68, 68, 0.1)", 
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "10px",
            padding: "8px 12px"
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
          </div>
          <div>
            <h1 style={{ 
              color: "#e4e4e7", 
              fontSize: "24px", 
              fontWeight: "700", 
              margin: "0 0 4px 0",
              fontFamily: "'oxanium', sans-serif"
            }}>
              API Documentation
            </h1>
            <p style={{ 
              color: "#71717a", 
              fontSize: "14px", 
              margin: "0"
            }}>
              IntelForge REST API — Search, Correlate, and Integrate
            </p>
          </div>
        </div>
      </div>
      
      {/* Swagger UI container */}
      <div style={{ minHeight: "calc(100vh - 200px)" }}>
        <div id="swagger-ui" style={{ minHeight: "calc(100vh - 200px)" }} />
      </div>
    </div>
  )
}
