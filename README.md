# IARE MUN 2026 - Official Registration & Management Platform

![IARE MUN Banner](https://raw.githubusercontent.com/karthiktatineni/munproduction/main/public/logo.png)

## 📌 Project Overview
The **IARE MUN 2026 Platform** is an enterprise-grade web application engineered for the **Institute of Aeronautical Engineering (IARE)** to manage their flagship Model United Nations conference. 

This platform is built for **scale, security, and high availability**, featuring a decoupled micro-architecture that separates the high-performance React frontend from the Node.js backend cluster. It handles complex multi-country allocations, dynamic payment structures, and real-time administrative oversight.

---

## 🛠 Project Architecture & Working

### 1. **The Gateway Pattern (NGINX Load Balancers)**
Instead of direct client-to-backend communication, the project uses a **Reverse Proxy Gateway**. 
*   **Load Balancing**: Two NGINX containers (`lb1` and `lb2`) distribute traffic across two production Render instances (`3sr4` and `o3tk`). This ensures that if one server goes down or restarts, the conference registration remains live.
*   **Security Layer**: NGINX hides the true backend URLs, preventing direct attacks on the API servers.
*   **Relative Pathing**: The frontend makes requests to `/api`. This path is intercepted by the gateway and securely forwarded via the `least_conn` algorithm to the healthiest backend.

### 2. **Multi-Layer Caching Strategy**
To minimize database costs and maximize speed, the project implements two tiers of caching:
*   **NGINX Proxy Cache**: GET requests to the Admin panel are cached at the edge for **5 minutes**. Repeated views of the dashboard load in milliseconds without hitting the backend.
*   **Backend In-Memory Cache**: The Node.js server maintains a 30-second internal state of the registration data, significantly reducing Firestore "Document Read" counts during peak registration hours.

---

## 🚀 Key Features

*   **🎓 Tiered Registration**: Custom pricing logic for School, Internal (IARE), and External delegates.
*   **⚡ 1st Year Discount Logic**: Automated fee adjustment for first-year students across all categories.
*   **📊 Admin Command Center**: 
    *   Real-time financial summaries.
    *   Country Matrix with drag-on-assign logic.
    *   One-click CSV/Excel export for logistics teams.
*   **💳 Payment Guard**: Smart UTR validation. Prevents duplicate payment entry across both OC and Delegate databases.
*   **🛡 Enterprise Security**: 
    *   `Helmet` (Header Security).
    *   `Rate Limiting` (DDoS protection).
    *   `Compression` (Optimized bandwidth).
    *   `SNI Support` (Secure SSL handshakes with Render).

---

## ⚙️ Local Installation & Setup

### Prerequisites
*   Node.js (v20+)
*   Docker Desktop
*   Git

### Launch the Production Stack
To build and run the dual load balancers locally:
```bash
docker-compose up --build -d
```
*   **LB 1**: [http://localhost:8081](http://localhost:8081)
*   **LB 2**: [http://localhost:8082](http://localhost:8082)

---

## 🌐 Deployment Guide

### **Frontend (Vercel)**
The `vercel.json` file is pre-configured to act as a cloud-based Load Balancer. It rewrites all `/api` calls to the Render backend cluster and manages edge caching for admin routes.

### **Backend (Render)**
Deploy the `backend` folder as two separate "Web Service" instances. The NGINX configuration in this repository will automatically balance traffic between them using the provided URLs.
