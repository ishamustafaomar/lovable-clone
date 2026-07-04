import Foundation

enum ProjectStatus: String, Codable, Equatable {
    case idle
    case generating
    case deploying
    case ready
    case error

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ProjectStatus(rawValue: raw) ?? .idle
    }

    var label: String {
        switch self {
        case .idle: return "Draft"
        case .generating: return "Generating"
        case .deploying: return "Deploying"
        case .ready: return "Live"
        case .error: return "Error"
        }
    }

    var isBusy: Bool { self == .generating || self == .deploying }
}

struct Project: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var icon: String
    var status: ProjectStatus
    var statusMessage: String?
    var previewUrl: String?
    var createdAt: Double
    var updatedAt: Double

    var updatedDate: Date { Date(timeIntervalSince1970: updatedAt / 1000) }
}

struct ChatMessage: Identifiable, Codable, Equatable {
    let id: String
    let role: String // "user" | "assistant" | "status" | "error"
    let content: String
    let createdAt: Double
}

struct ProjectFile: Identifiable, Codable, Equatable {
    let path: String
    let content: String
    var id: String { path }
}

struct ProjectDetail: Codable {
    let project: Project
    let messages: [ChatMessage]
}

// MARK: - API payloads

struct ProjectListResponse: Codable {
    let projects: [Project]
}

struct CreateProjectResponse: Codable {
    let projectId: String
}

struct FilesResponse: Codable {
    let files: [ProjectFile]
}

struct OKResponse: Codable {
    let ok: Bool
}

struct APIErrorBody: Codable {
    let error: String
}
