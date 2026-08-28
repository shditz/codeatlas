plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.22"
    id("org.jetbrains.intellij") version "1.17.2"
}

group = "com.codeatlas"
version = "0.1.0"

repositories {
    mavenCentral()
}

intellij {
    version.set("2023.3.4")
    type.set("IC")
    plugins.set(listOf("com.intellij.java"))
}

tasks {
    patchPluginXml {
        sinceBuild.set("233")
        untilBuild.set("243.*")
    }
}
