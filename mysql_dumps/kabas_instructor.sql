CREATE DATABASE  IF NOT EXISTS `kabas` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `kabas`;
-- MySQL dump 10.13  Distrib 8.0.34, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: kabas
-- ------------------------------------------------------
-- Server version	8.0.35

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `instructor`
--

DROP TABLE IF EXISTS `instructor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `instructor` (
  `iid` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `jiraToken` varbinary(512) DEFAULT NULL,
  `githubToken` varbinary(512) DEFAULT NULL,
  PRIMARY KEY (`iid`),
  UNIQUE KEY `iid_UNIQUE` (`iid`),
  UNIQUE KEY `email_UNIQUE` (`email`),
  UNIQUE KEY `jiraToken_UNIQUE` (`jiraToken`),
  UNIQUE KEY `githubToken_UNIQUE` (`githubToken`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `instructor`
--

LOCK TABLES `instructor` WRITE;
/*!40000 ALTER TABLE `instructor` DISABLE KEYS */;
INSERT INTO `instructor` VALUES (1,'2303610@sit.singaporetech.edu.sg',_binary 'z>Ì…e\Þ|–´Ê«Èµuq\'þK-\Ã-9t{¢n%O\Ïþ|\ÃJ\0\Âxc\Ï°œü?Ú¾k\Ç0jp\â‘Ò7¸*Ñ¦‚øW¥šœª\Ç\Ú\è\èõN”›/N8>ò\\¾T\É77\éRÀ\Ì[ÌŒS–f›òVd ‹@þr‰\È\ÛBŽ\êRxuý©´“5[¾.el@~M¢½ð²\íY\éBœ\Zn\Ï9±wú˜\Êk\ï\ØXO\ãºD\Û7ú\r^mj\Ü|<&”Ct\ÚZŠ–S’\Ë\Ñ1\Õ]l',_binary '&@|\Ð\çõ®go6„^\ã/fA¶=\Ía¯XB\"\ÄsÖŒ\Ü$5>Ó˜\â\Ì”Ý¤ˆ\Ìõ'),(2,'2303629@sit.singaporetech.edu.sg',NULL,_binary 'þ ª\à•‹\Ðû¼£ª\ìB»\Ïl}ˆYõ\í=Gq7NLPLfG¦…q\æ\Ù\Èü\Ø\î›');
/*!40000 ALTER TABLE `instructor` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-30  4:53:18
