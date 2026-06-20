-- MariaDB dump 10.19  Distrib 10.4.28-MariaDB, for osx10.10 (x86_64)
--
-- Host: localhost    Database: la_llar
-- ------------------------------------------------------
-- Server version	10.4.28-MariaDB
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `la_llar`
--

/*!40000 DROP DATABASE IF EXISTS `la_llar`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `la_llar` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `la_llar`;

--
-- Table structure for table `asistencias`
--

DROP TABLE IF EXISTS `asistencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `asistencias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empleado_id` int(11) NOT NULL,
  `sucursal_id` int(11) NOT NULL,
  `tipo` enum('entrada','salida') NOT NULL,
  `timestamp` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `asistencias_empleado_id_fkey` (`empleado_id`),
  KEY `asistencias_sucursal_id_fkey` (`sucursal_id`),
  CONSTRAINT `asistencias_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `asistencias_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=444 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asistencias`
--

LOCK TABLES `asistencias` WRITE;
/*!40000 ALTER TABLE `asistencias` DISABLE KEYS */;
INSERT INTO `asistencias` (`id`, `empleado_id`, `sucursal_id`, `tipo`, `timestamp`) VALUES (330,1,1,'entrada','2026-05-01 08:09:00.000'),(331,1,1,'salida','2026-05-01 17:09:00.000'),(332,2,1,'entrada','2026-05-01 07:50:00.000'),(333,2,1,'salida','2026-05-01 16:50:00.000'),(334,3,2,'entrada','2026-05-01 09:00:00.000'),(335,3,2,'salida','2026-05-01 18:02:00.000'),(336,1,1,'entrada','2026-05-04 08:08:00.000'),(337,1,1,'salida','2026-05-04 17:08:00.000'),(338,2,1,'entrada','2026-05-04 07:59:00.000'),(339,2,1,'salida','2026-05-04 16:59:00.000'),(340,3,2,'entrada','2026-05-04 09:00:00.000'),(341,3,2,'salida','2026-05-04 18:01:00.000'),(342,1,1,'entrada','2026-05-05 08:04:00.000'),(343,1,1,'salida','2026-05-05 17:04:00.000'),(344,2,1,'entrada','2026-05-05 07:56:00.000'),(345,2,1,'salida','2026-05-05 16:56:00.000'),(346,3,2,'entrada','2026-05-05 09:05:00.000'),(347,3,2,'salida','2026-05-05 18:08:00.000'),(348,1,1,'entrada','2026-05-06 08:00:00.000'),(349,1,1,'salida','2026-05-06 17:00:00.000'),(350,2,1,'entrada','2026-05-06 07:52:00.000'),(351,2,1,'salida','2026-05-06 16:52:00.000'),(352,3,2,'entrada','2026-05-06 09:01:00.000'),(353,3,2,'salida','2026-05-06 18:04:00.000'),(354,1,1,'entrada','2026-05-07 08:07:00.000'),(355,1,1,'salida','2026-05-07 17:07:00.000'),(356,2,1,'entrada','2026-05-07 07:59:00.000'),(357,2,1,'salida','2026-05-07 16:59:00.000'),(358,3,2,'entrada','2026-05-07 09:00:00.000'),(359,3,2,'salida','2026-05-07 18:00:00.000'),(360,1,1,'entrada','2026-05-08 08:03:00.000'),(361,2,1,'entrada','2026-05-08 07:55:00.000'),(362,2,1,'salida','2026-05-08 16:55:00.000'),(363,3,2,'entrada','2026-05-08 09:04:00.000'),(364,3,2,'salida','2026-05-08 18:07:00.000'),(365,1,1,'entrada','2026-05-11 08:02:00.000'),(366,1,1,'salida','2026-05-11 17:02:00.000'),(367,2,1,'entrada','2026-05-11 07:54:00.000'),(368,2,1,'salida','2026-05-11 16:54:00.000'),(369,3,2,'entrada','2026-05-11 09:03:00.000'),(370,3,2,'salida','2026-05-11 18:06:00.000'),(371,1,1,'entrada','2026-05-12 08:09:00.000'),(372,1,1,'salida','2026-05-12 17:09:00.000'),(373,2,1,'entrada','2026-05-12 07:50:00.000'),(374,2,1,'salida','2026-05-12 16:50:00.000'),(375,1,1,'entrada','2026-05-13 08:05:00.000'),(376,1,1,'salida','2026-05-13 17:05:00.000'),(377,2,1,'entrada','2026-05-13 07:57:00.000'),(378,2,1,'salida','2026-05-13 16:57:00.000'),(379,1,1,'entrada','2026-05-14 08:01:00.000'),(380,1,1,'salida','2026-05-14 17:01:00.000'),(381,2,1,'entrada','2026-05-14 07:53:00.000'),(382,2,1,'salida','2026-05-14 16:53:00.000'),(383,1,1,'entrada','2026-05-15 08:08:00.000'),(384,1,1,'salida','2026-05-15 17:08:00.000'),(385,2,1,'entrada','2026-05-15 07:59:00.000'),(386,2,1,'salida','2026-05-15 16:59:00.000'),(387,1,1,'entrada','2026-05-18 08:07:00.000'),(388,1,1,'salida','2026-05-18 17:07:00.000'),(389,2,1,'entrada','2026-05-18 07:59:00.000'),(390,2,1,'salida','2026-05-18 16:59:00.000'),(391,3,2,'entrada','2026-05-18 09:00:00.000'),(392,3,2,'salida','2026-05-18 18:00:00.000'),(393,1,1,'entrada','2026-05-19 08:03:00.000'),(394,1,1,'salida','2026-05-19 17:03:00.000'),(395,3,2,'entrada','2026-05-19 09:04:00.000'),(396,3,2,'salida','2026-05-19 18:07:00.000'),(397,1,1,'entrada','2026-05-20 08:10:00.000'),(398,1,1,'salida','2026-05-20 17:10:00.000'),(399,3,2,'entrada','2026-05-20 09:00:00.000'),(400,3,2,'salida','2026-05-20 18:03:00.000'),(401,1,1,'entrada','2026-05-21 08:06:00.000'),(402,1,1,'salida','2026-05-21 17:06:00.000'),(403,3,2,'entrada','2026-05-21 09:07:00.000'),(404,3,2,'salida','2026-05-21 18:10:00.000'),(405,1,1,'entrada','2026-05-22 08:02:00.000'),(406,1,1,'salida','2026-05-22 17:02:00.000'),(407,3,2,'entrada','2026-05-22 09:03:00.000'),(408,3,2,'salida','2026-05-22 18:06:00.000'),(409,1,1,'entrada','2026-05-25 08:01:00.000'),(410,1,1,'salida','2026-05-25 17:01:00.000'),(411,2,1,'entrada','2026-05-25 07:53:00.000'),(412,2,1,'salida','2026-05-25 16:53:00.000'),(413,3,2,'entrada','2026-05-25 09:02:00.000'),(414,3,2,'salida','2026-05-25 18:05:00.000'),(415,1,1,'entrada','2026-05-26 08:08:00.000'),(416,1,1,'salida','2026-05-26 17:08:00.000'),(417,2,1,'entrada','2026-05-26 07:59:00.000'),(418,2,1,'salida','2026-05-26 16:59:00.000'),(419,3,2,'entrada','2026-05-26 09:00:00.000'),(420,3,2,'salida','2026-05-26 18:01:00.000'),(421,1,1,'entrada','2026-05-27 08:04:00.000'),(422,1,1,'salida','2026-05-27 17:04:00.000'),(423,2,1,'entrada','2026-05-27 07:56:00.000'),(424,2,1,'salida','2026-05-27 16:56:00.000'),(425,3,2,'entrada','2026-05-27 09:05:00.000'),(426,3,2,'salida','2026-05-27 18:08:00.000'),(427,1,1,'entrada','2026-05-28 08:00:00.000'),(428,1,1,'salida','2026-05-28 17:00:00.000'),(429,2,1,'entrada','2026-05-28 07:52:00.000'),(430,2,1,'salida','2026-05-28 16:52:00.000'),(431,3,2,'entrada','2026-05-28 09:01:00.000'),(432,3,2,'salida','2026-05-28 18:04:00.000'),(433,1,1,'entrada','2026-05-29 08:07:00.000'),(434,1,1,'salida','2026-05-29 17:07:00.000'),(435,2,1,'entrada','2026-05-29 07:59:00.000'),(436,2,1,'salida','2026-05-29 16:59:00.000'),(437,3,2,'entrada','2026-05-29 09:00:00.000'),(438,3,2,'salida','2026-05-29 18:00:00.000'),(442,16,1,'entrada','2026-06-07 22:23:18.000'),(443,16,1,'salida','2026-06-07 22:24:13.000');
/*!40000 ALTER TABLE `asistencias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `correcciones_asistencia`
--

DROP TABLE IF EXISTS `correcciones_asistencia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `correcciones_asistencia` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empleado_id` int(11) NOT NULL,
  `fecha` varchar(10) NOT NULL,
  `entrada` varchar(5) DEFAULT NULL,
  `salida` varchar(5) DEFAULT NULL,
  `corregido_por` int(11) NOT NULL,
  `creado_en` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `correcciones_asistencia_empleado_id_fecha_key` (`empleado_id`,`fecha`),
  CONSTRAINT `correcciones_asistencia_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `correcciones_asistencia`
--

LOCK TABLES `correcciones_asistencia` WRITE;
/*!40000 ALTER TABLE `correcciones_asistencia` DISABLE KEYS */;
INSERT INTO `correcciones_asistencia` (`id`, `empleado_id`, `fecha`, `entrada`, `salida`, `corregido_por`, `creado_en`) VALUES (5,16,'2026-06-07','07:23','15:24',1,'2026-06-14 20:40:45.820'),(6,16,'2026-06-15',NULL,NULL,1,'2026-06-14 20:41:08.530'),(7,16,'2026-06-16',NULL,NULL,1,'2026-06-14 20:41:14.235'),(8,16,'2026-06-26',NULL,NULL,1,'2026-06-14 20:41:20.529');
/*!40000 ALTER TABLE `correcciones_asistencia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documentos_proveedor`
--

DROP TABLE IF EXISTS `documentos_proveedor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `documentos_proveedor` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `proveedor_id` int(11) NOT NULL,
  `nombre_original` varchar(255) NOT NULL,
  `ruta_archivo` varchar(500) NOT NULL,
  `tipo_mime` varchar(100) NOT NULL,
  `subido_por` int(11) NOT NULL,
  `creado_en` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `estado` enum('pendiente','aprobado','desaprobado') NOT NULL DEFAULT 'pendiente',
  PRIMARY KEY (`id`),
  KEY `documentos_proveedor_proveedor_id_fkey` (`proveedor_id`),
  CONSTRAINT `documentos_proveedor_proveedor_id_fkey` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documentos_proveedor`
--

LOCK TABLES `documentos_proveedor` WRITE;
/*!40000 ALTER TABLE `documentos_proveedor` DISABLE KEYS */;
INSERT INTO `documentos_proveedor` (`id`, `proveedor_id`, `nombre_original`, `ruta_archivo`, `tipo_mime`, `subido_por`, `creado_en`, `estado`) VALUES (1,1,'Contrato_Suministro_2025.pdf','9c05236e-a384-4abe-90dd-2dd5e10787d2.pdf','application/pdf',1,'2026-05-29 18:00:34.324','aprobado'),(2,1,'Facturas_Enero_2025.pdf','77bcd419-4a0c-4193-b9dd-6bc60c6fa209.pdf','application/pdf',1,'2026-05-29 18:00:34.326','aprobado'),(4,2,'Carta_Presentacion.pdf','24760bb0-4b7a-4403-9c6e-a0b4b9b03cbc.pdf','application/pdf',1,'2026-05-29 18:00:34.329','aprobado'),(6,4,'Propuesta_Comercial_2025.pdf','5ad67ff8-8d9a-4b68-951a-d42f7f6a78c5.pdf','application/pdf',1,'2026-05-29 18:00:34.331','aprobado'),(7,1,'Acta_Constitutiva.pdf','0852b98b-740b-4cc1-b019-14efcb0064e6.pdf','application/pdf',1,'2026-05-29 18:41:15.525','aprobado');
/*!40000 ALTER TABLE `documentos_proveedor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documentos_unidad`
--

DROP TABLE IF EXISTS `documentos_unidad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `documentos_unidad` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sucursal_id` int(11) NOT NULL,
  `nombre_original` varchar(255) NOT NULL,
  `ruta_archivo` varchar(500) NOT NULL,
  `tipo_mime` varchar(100) NOT NULL,
  `subido_por` int(11) NOT NULL,
  `creado_en` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `estado` enum('pendiente','aprobado','desaprobado') NOT NULL DEFAULT 'pendiente',
  PRIMARY KEY (`id`),
  KEY `documentos_unidad_sucursal_id_fkey` (`sucursal_id`),
  CONSTRAINT `documentos_unidad_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documentos_unidad`
--

LOCK TABLES `documentos_unidad` WRITE;
/*!40000 ALTER TABLE `documentos_unidad` DISABLE KEYS */;
INSERT INTO `documentos_unidad` (`id`, `sucursal_id`, `nombre_original`, `ruta_archivo`, `tipo_mime`, `subido_por`, `creado_en`, `estado`) VALUES (1,1,'Inventario_Cocina_Central.pdf','beb056a0-90ff-43ab-9613-4353a36282d7.pdf','application/pdf',1,'2026-06-01 19:36:25.098','aprobado'),(2,1,'Bitacora_Limpieza_Enero.pdf','7d8aca3f-b1b8-40c1-b489-a197e5878c82.pdf','application/pdf',1,'2026-06-01 19:36:25.100','aprobado'),(3,2,'Permiso_Funcionamiento_Norte.pdf','b7aa8559-359c-464c-8171-9384e2bc4e7f.pdf','application/pdf',1,'2026-06-01 19:36:25.101','aprobado'),(4,2,'Control_Temperaturas_Norte.pdf','7919a49b-968f-40c7-914d-369450906733.pdf','application/pdf',1,'2026-06-01 19:36:25.102','desaprobado'),(5,4,'Acta_Fumigacion_Oriente.pdf','e21820b8-2616-461d-92e4-de5395b68f71.pdf','application/pdf',1,'2026-06-01 19:36:25.102','pendiente');
/*!40000 ALTER TABLE `documentos_unidad` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `empleados`
--

DROP TABLE IF EXISTS `empleados`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `empleados` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `lector_uid` varchar(100) NOT NULL,
  `sucursal_id` int(11) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `empleados_lector_uid_sucursal_id_key` (`lector_uid`,`sucursal_id`),
  KEY `empleados_sucursal_id_fkey` (`sucursal_id`),
  CONSTRAINT `empleados_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `empleados`
--

LOCK TABLES `empleados` WRITE;
/*!40000 ALTER TABLE `empleados` DISABLE KEYS */;
INSERT INTO `empleados` (`id`, `nombre`, `lector_uid`, `sucursal_id`, `activo`, `creado_en`) VALUES (1,'Ana García Martínez','UID001',1,1,'2026-05-29 17:30:17.373'),(2,'Luis Hernández López','UID002',1,1,'2026-05-29 17:30:17.375'),(3,'María Torres Ruiz','UID003',2,1,'2026-05-29 17:30:17.375'),(4,'Carlos Mendoza Vega','UID004',2,1,'2026-05-29 17:30:17.376'),(5,'Sofía Ramírez Castro','UID005',3,1,'2026-05-29 17:30:17.377'),(6,'Javier Morales Fuentes','UID006',3,1,'2026-05-29 17:30:17.377'),(7,'Patricia Jiménez Reyes','UID007',4,1,'2026-05-29 17:30:17.378'),(8,'Roberto Sánchez Díaz','UID008',4,1,'2026-05-29 17:30:17.378'),(9,'Elena Vargas Núñez','UID009',1,1,'2026-05-29 17:30:17.379'),(10,'Diego Peña Aguilar','UID010',2,1,'2026-05-29 17:30:17.379'),(11,'Gabriela Ríos Castillo','UID011',3,1,'2026-05-29 17:30:17.380'),(12,'Fernando López Guzmán','UID012',4,1,'2026-05-29 17:30:17.380'),(16,'Emilio Arriaga Guzman','13',1,1,'2026-06-08 03:59:18.511');
/*!40000 ALTER TABLE `empleados` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `justificaciones`
--

DROP TABLE IF EXISTS `justificaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `justificaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empleado_id` int(11) NOT NULL,
  `fecha` varchar(10) NOT NULL,
  `tipo` enum('vacaciones','incapacidad','permiso','falta_justificada') NOT NULL,
  `nota` varchar(300) DEFAULT NULL,
  `creado_por` int(11) NOT NULL,
  `creado_en` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `justificaciones_empleado_id_fecha_key` (`empleado_id`,`fecha`),
  CONSTRAINT `justificaciones_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `justificaciones`
--

LOCK TABLES `justificaciones` WRITE;
/*!40000 ALTER TABLE `justificaciones` DISABLE KEYS */;
INSERT INTO `justificaciones` (`id`, `empleado_id`, `fecha`, `tipo`, `nota`, `creado_por`, `creado_en`) VALUES (28,3,'2026-05-12','incapacidad','Incapacidad IMSS folio 8842-26',1,'2026-06-01 19:36:25.116'),(29,3,'2026-05-13','incapacidad','Incapacidad IMSS folio 8842-26',1,'2026-06-01 19:36:25.116'),(30,3,'2026-05-14','incapacidad','Incapacidad IMSS folio 8842-26',1,'2026-06-01 19:36:25.116'),(31,3,'2026-05-15','incapacidad','Incapacidad IMSS folio 8842-26',1,'2026-06-01 19:36:25.116'),(32,2,'2026-05-19','vacaciones','Vacaciones programadas',1,'2026-06-01 19:36:25.116'),(33,2,'2026-05-20','vacaciones','Vacaciones programadas',1,'2026-06-01 19:36:25.116'),(34,2,'2026-05-21','vacaciones','Vacaciones programadas',1,'2026-06-01 19:36:25.116'),(35,2,'2026-05-22','vacaciones','Vacaciones programadas',1,'2026-06-01 19:36:25.116'),(36,16,'2026-06-15','vacaciones','Autorizadas',1,'2026-06-14 20:41:08.534'),(37,16,'2026-06-16','vacaciones',NULL,1,'2026-06-14 20:41:14.238'),(38,16,'2026-06-26','incapacidad',NULL,1,'2026-06-14 20:41:20.538');
/*!40000 ALTER TABLE `justificaciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `proveedores`
--

DROP TABLE IF EXISTS `proveedores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `proveedores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `rfc` varchar(20) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `proveedores`
--

LOCK TABLES `proveedores` WRITE;
/*!40000 ALTER TABLE `proveedores` DISABLE KEYS */;
INSERT INTO `proveedores` (`id`, `nombre`, `rfc`, `activo`, `creado_en`) VALUES (1,'Distribuidora Alimentos del Norte SA de CV','DAN210301ABC',1,'2026-05-29 18:00:34.246'),(2,'Carnes y Embutidos Hernández','CEH180615XYZ',1,'2026-05-29 18:00:34.253'),(3,'Verduras Orgánicas del Valle','VOV200815JKL',1,'2026-05-29 18:00:34.254'),(4,'Lácteos La Fuente','LLF190420MNO',1,'2026-05-29 18:00:34.258'),(6,'Distribuidora Herdez',NULL,1,'2026-06-04 05:56:33.360');
/*!40000 ALTER TABLE `proveedores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sucursales`
--

DROP TABLE IF EXISTS `sucursales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sucursales` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sucursales`
--

LOCK TABLES `sucursales` WRITE;
/*!40000 ALTER TABLE `sucursales` DISABLE KEYS */;
INSERT INTO `sucursales` (`id`, `nombre`, `activo`) VALUES (1,'Cocina Central',1),(2,'Sucursal Norte',1),(3,'Sucursal Sur',1),(4,'Sucursal Oriente',1);
/*!40000 ALTER TABLE `sucursales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `email` varchar(200) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` enum('administrador','gerente','proveedor') NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `sucursal_id` int(11) DEFAULT NULL,
  `proveedor_id` int(11) DEFAULT NULL,
  `creado_en` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuarios_email_key` (`email`),
  KEY `usuarios_sucursal_id_fkey` (`sucursal_id`),
  KEY `usuarios_proveedor_id_fkey` (`proveedor_id`),
  CONSTRAINT `usuarios_proveedor_id_fkey` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `usuarios_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `password`, `rol`, `activo`, `sucursal_id`, `proveedor_id`, `creado_en`) VALUES (1,'Administrador','admin@lallar.com','$2b$10$aeup4Po6eE3vTWC0XrZ4du0EUQ7h5.IliGY0GkeqZgytrQFjDfgSi','administrador',1,NULL,NULL,'2026-05-29 05:52:18.683'),(2,'Distribuidora Norte','norte@distribuidora.com','$2b$10$owd2HGDTjqNFmgmOt6jL/.qhHc4tntIqCrYRi8RS2.Uey2Jf.Peua','proveedor',1,NULL,1,'2026-05-29 18:00:34.310'),(3,'Carnes Hernández','hernandez@carnes.com','$2b$10$owd2HGDTjqNFmgmOt6jL/.qhHc4tntIqCrYRi8RS2.Uey2Jf.Peua','proveedor',1,NULL,2,'2026-05-29 18:00:34.313'),(4,'Verduras del Valle','contacto@verdurvallle.com','$2b$10$owd2HGDTjqNFmgmOt6jL/.qhHc4tntIqCrYRi8RS2.Uey2Jf.Peua','proveedor',1,NULL,3,'2026-05-29 18:00:34.314'),(5,'Lácteos La Fuente','ventas@lacteoslafuente.com','$2b$10$owd2HGDTjqNFmgmOt6jL/.qhHc4tntIqCrYRi8RS2.Uey2Jf.Peua','proveedor',1,NULL,4,'2026-05-29 18:00:34.315'),(6,'Gerente Cocina Central','gerente.central@lallar.com','$2b$10$4oy3Bk2cKPmNDyOzV9Qh8uQd9oydpFNXRvlhGeQprochrEsPeX.lm','gerente',1,1,NULL,'2026-06-01 19:36:25.066'),(7,'Gerente Sucursal Norte','gerente.norte@lallar.com','$2b$10$4oy3Bk2cKPmNDyOzV9Qh8uQd9oydpFNXRvlhGeQprochrEsPeX.lm','gerente',1,2,NULL,'2026-06-01 19:36:25.077'),(8,'Gerente Sucursal Sur','gerente.sur@lallar.com','$2b$10$4oy3Bk2cKPmNDyOzV9Qh8uQd9oydpFNXRvlhGeQprochrEsPeX.lm','gerente',1,3,NULL,'2026-06-01 19:36:25.079'),(9,'Gerente Sucursal Oriente','gerente.oriente@lallar.com','$2b$10$4oy3Bk2cKPmNDyOzV9Qh8uQd9oydpFNXRvlhGeQprochrEsPeX.lm','gerente',1,4,NULL,'2026-06-01 19:36:25.085');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ventanas_carga`
--

DROP TABLE IF EXISTS `ventanas_carga`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ventanas_carga` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `modulo` enum('proveedores','unidades') NOT NULL,
  `abierta` tinyint(1) NOT NULL DEFAULT 0,
  `desde` datetime(3) DEFAULT NULL,
  `hasta` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ventanas_carga_modulo_key` (`modulo`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ventanas_carga`
--

LOCK TABLES `ventanas_carga` WRITE;
/*!40000 ALTER TABLE `ventanas_carga` DISABLE KEYS */;
INSERT INTO `ventanas_carga` (`id`, `modulo`, `abierta`, `desde`, `hasta`) VALUES (1,'proveedores',0,NULL,NULL),(2,'unidades',0,NULL,NULL);
/*!40000 ALTER TABLE `ventanas_carga` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'la_llar'
--

--
-- Dumping routines for database 'la_llar'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-15 14:14:39
