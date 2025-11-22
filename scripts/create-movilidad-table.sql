-- Tabla para almacenar planillas de movilidad
-- Similar a CntCtaRendicionDocumentosIA y CntCtaCajaChicaDocumentosIA

CREATE TABLE [dbo].[CntCtaMovilidadPlanillas] (
    -- Identificación única
    [ID] NVARCHAR(255) NOT NULL PRIMARY KEY,
    [NroPlanilla] NVARCHAR(50),

    -- Información de la empresa
    [RazonSocial] NVARCHAR(255),
    [RUC] NVARCHAR(50),
    [Periodo] NVARCHAR(100),
    [FechaEmision] DATETIME,

    -- Datos del trabajador
    [NombresApellidos] NVARCHAR(255),
    [Cargo] NVARCHAR(255),
    [DNI] NVARCHAR(20),
    [CentroCosto] NVARCHAR(100),

    -- Totales
    [TotalViaje] FLOAT,
    [TotalDia] FLOAT,
    [TotalGeneral] FLOAT,

    -- Metadatos
    [Usuario] VARCHAR(100),
    [NroRend] INT NULL,
    [NroCajaChica] INT NULL,
    [TipoOperacion] VARCHAR(20), -- 'RENDICION' o 'CAJA_CHICA'
    [Estado] NVARCHAR(255),

    -- OCR y verificación
    [OCRData] NVARCHAR(MAX), -- JSON con datos extraídos por OCR
    [ImageUrl] NVARCHAR(500),

    -- Auditoría
    [FechaCreacion] DATETIME DEFAULT GETDATE(),
    [FechaModificacion] DATETIME DEFAULT GETDATE()
);

-- Tabla de detalle de gastos de movilidad (múltiples registros por planilla)
CREATE TABLE [dbo].[CntCtaMovilidadGastos] (
    [ID] INT IDENTITY(1,1) PRIMARY KEY,
    [PlanillaID] NVARCHAR(255) NOT NULL,

    -- Fecha del gasto
    [FechaGasto] DATETIME,
    [Dia] INT,
    [Mes] INT,
    [Anio] INT,

    -- Descripción del desplazamiento
    [Motivo] NVARCHAR(500),
    [Origen] NVARCHAR(255),
    [Destino] NVARCHAR(255),

    -- Montos
    [MontoViaje] FLOAT,
    [MontoDia] FLOAT,

    -- Auditoría
    [FechaCreacion] DATETIME DEFAULT GETDATE(),

    -- Foreign key
    FOREIGN KEY ([PlanillaID]) REFERENCES [dbo].[CntCtaMovilidadPlanillas]([ID]) ON DELETE CASCADE
);

-- Índices para mejorar rendimiento
CREATE INDEX IX_MovilidadPlanillas_Usuario ON [dbo].[CntCtaMovilidadPlanillas]([Usuario]);
CREATE INDEX IX_MovilidadPlanillas_FechaEmision ON [dbo].[CntCtaMovilidadPlanillas]([FechaEmision]);
CREATE INDEX IX_MovilidadPlanillas_NroRend ON [dbo].[CntCtaMovilidadPlanillas]([NroRend]);
CREATE INDEX IX_MovilidadPlanillas_NroCajaChica ON [dbo].[CntCtaMovilidadPlanillas]([NroCajaChica]);
CREATE INDEX IX_MovilidadGastos_PlanillaID ON [dbo].[CntCtaMovilidadGastos]([PlanillaID]);
CREATE INDEX IX_MovilidadGastos_FechaGasto ON [dbo].[CntCtaMovilidadGastos]([FechaGasto]);

PRINT 'Tablas de movilidad creadas exitosamente';
