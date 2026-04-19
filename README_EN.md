[🇰🇷 한국어](./README.md) | [🇺🇸 English](./README_EN.md)

# 🐾 Pet-Walk: Dog-Friendly Walk Route Risk Analysis & Recommendation System

A backend system that recommends optimal walking routes for pet owners by analyzing **terrain data (slope, surface material), real-time weather conditions, and nearby facility information** to ensure safe and comfortable walks.

---

## 🏗 System Architecture

![Overall Architecture](./image/overall_architecture.png)

| Layer | Service | Role |
|-------|---------|------|
| Data Ingestion | Azure Data Factory | Automated collection from OSM, V-World, Seoul API, S-DoT |
| Data Processing | Azure Databricks (Apache Sedona) | Spatial join & feature engineering |
| Data Storage | Azure Blob Storage (raw / silver / gold) | Layered data lake |
| Database | Azure Database for PostgreSQL (PostGIS) | Spatial data serving |
| Backend | FastAPI + Azure Web App | Containerized API server |
| AI | Azure OpenAI (GPT-4o / GPT-4o-mini) | Natural language route recommendations |

---

## 🛠 Data Pipeline

### 1. Data Ingestion (Azure Data Factory)

Automated collection from 4 public data sources via Azure Data Factory.

![Data Factory Pipeline](./image/datafactory_pipeline.png)
![Data Factory Linked Services](./image/datafactory_Linked_serivce.png)

- **OSM (Geofabrik)**: Road centerlines and pedestrian network (PBF format)
- **V-World**: Soil material, gravel content, drainage grade and other terrain features
- **Seoul Open Data API**: Pet-friendly cafes and nearby veterinary clinics
- **S-DoT**: Real-time noise and vibration data along walking routes

### 2. Data Processing (Azure Databricks)

Spatial joins across 130,000+ road segments using Apache Sedona on Azure Databricks, producing three dog-specific risk metrics:

- **Heat Risk**: Based on surface temperature, solar absorption, and soil thermal properties
- **Roughness Score**: Based on surface material and gravel content
- **Cushion Index**: Based on soil depth and drainage grade

> **▶️ Execution Order**: `bronze_raw.ipynb` → `silver.ipynb`  
> `%restart_python` is required after Sedona installs. See [Databricks Pipeline Guide](./databricks/README.md) for details.

### 3. Data Storage (Layered Data Lake)

Azure Blob Storage structured in Raw → Silver → Gold layers for progressive data quality management.

### 4. Database Design (PostgreSQL + PostGIS)

![ERD](./image/ERD.png)

Designed with scalability in mind by separating trail characteristics (`walk_features`) from environmental data (`walk_environment`). Processed `LINESTRING` geometries are accurately mapped to Seoul's coordinate system via PostGIS.

---

## 🚀 Backend Service

### Deployment Flow

```mermaid
graph LR
    A[Local Code] -- "git push" --> B[GitHub Repository]
    B -- "Manual Trigger" --> C[GitHub Actions]
    C -- "Docker Build & Push" --> D[Azure Container Registry]
    D -- "Pull & Deploy" --> E[Azure Web App]

    subgraph "Azure Cloud"
    D
    E
    end
```

Manual deployment (Workflow Dispatch) adopted for cost optimization.

### Project Structure

```text
SecondProjectTeam3/
├── .github/workflows/    # CI/CD workflow (Azure deployment)
├── backend/
│   └── app/
│       ├── api/          # API endpoints (recommendations, map, safety info)
│       ├── core/         # Configuration
│       ├── models/       # Pydantic data models
│       ├── services/     # Business logic (slope calculation, route search, etc.)
│       └── main.py
├── databricks/           # Databricks notebooks & scripts
│   ├── bronze_raw.ipynb  # Blob Storage → Bronze Delta ingestion
│   └── silver.ipynb      # Spatial join & feature engineering → Silver Delta
├── data/                 # Spatial datasets (SHP, GPX, GeoJSON)
├── frontend/             # React Native mobile app
├── image/                # README assets
├── docs/                 # Project documentation
├── Dockerfile
└── requirements.txt
```

### Local Setup

```bash
pip install -r requirements.txt
cd backend
uvicorn app.main:app --reload
# API docs: http://127.0.0.1:8000/docs
```

---

## 🔗 Documentation

| Document | Description |
|----------|-------------|
| [Data Dictionary](./docs/data_dictionary.md) | Column/type definitions for collected and processed data |
| [Scoring Logic](./docs/scoring_logic.md) | Detailed algorithm for heat risk, roughness, and cushion scores |
| [Backend Guide](./docs/backend_guide.md) | Backend setup and feature guide |
| [Frontend Guide](./docs/frontend_guide.md) | Frontend setup and screen guide |
| [API Documentation](./docs/api_documentation.md) | API endpoint specifications |
| [Azure Deployment Guide](./docs/azure_developer_guide.md) | Azure deployment, CI/CD setup, and cost management |
| [Small Scale Dev Guide](./docs/small_scale_dev_guide.md) | Folder structure and import path guide for loop route features |

## 📦 Tech Stack

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-0078D4?style=flat-square&logo=microsoftazure&logoColor=white)
![Apache Spark](https://img.shields.io/badge/Apache%20Spark-E25A1C?style=flat-square&logo=apachespark&logoColor=white)
![Apache Sedona](https://img.shields.io/badge/Apache%20Sedona-326CE5?style=flat-square&logoColor=white)
![PostGIS](https://img.shields.io/badge/PostGIS-336791?style=flat-square&logoColor=white)
