import Foundation

enum APIError: LocalizedError {
    case notConfigured
    case badURL
    case server(String)
    case http(Int)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Backend not configured. Open Settings and enter your Convex deployment URL."
        case .badURL:
            return "The backend URL is invalid."
        case .server(let message):
            return message
        case .http(let code):
            return "Server returned status \(code)."
        }
    }
}

/// Thin async client for the Forge Convex backend (HTTP actions on *.convex.site).
final class APIClient {
    static let shared = APIClient()

    static let backendURLKey = "backendURL"

    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: config)
    }

    var baseURL: URL? {
        guard var raw = UserDefaults.standard.string(forKey: Self.backendURLKey),
              !raw.isEmpty else { return nil }
        if !raw.hasPrefix("http") { raw = "https://" + raw }
        while raw.hasSuffix("/") { raw.removeLast() }
        return URL(string: raw)
    }

    var isConfigured: Bool { baseURL != nil }

    // MARK: - Endpoints

    func health() async throws -> Bool {
        struct Health: Codable { let ok: Bool }
        let health: Health = try await get("/api/health")
        return health.ok
    }

    func listProjects() async throws -> [Project] {
        let response: ProjectListResponse = try await get("/api/projects")
        return response.projects
    }

    func createProject(name: String, prompt: String) async throws -> String {
        let body = ["name": name, "prompt": prompt]
        let response: CreateProjectResponse = try await post("/api/projects", body: body)
        return response.projectId
    }

    func projectDetail(id: String) async throws -> ProjectDetail {
        try await get("/api/projects/\(id)")
    }

    func projectFiles(id: String) async throws -> [ProjectFile] {
        let response: FilesResponse = try await get("/api/projects/\(id)/files")
        return response.files
    }

    func sendMessage(projectId: String, prompt: String) async throws {
        let _: OKResponse = try await post("/api/projects/\(projectId)/messages", body: ["prompt": prompt])
    }

    func wakeProject(id: String) async throws {
        let _: OKResponse = try await post("/api/projects/\(id)/wake", body: [String: String]())
    }

    func deleteProject(id: String) async throws {
        let _: OKResponse = try await request(path: "/api/projects/\(id)", method: "DELETE", bodyData: nil)
    }

    // MARK: - Plumbing

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try await request(path: path, method: "GET", bodyData: nil)
    }

    private func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        let data = try JSONEncoder().encode(body)
        return try await request(path: path, method: "POST", bodyData: data)
    }

    private func request<T: Decodable>(path: String, method: String, bodyData: Data?) async throws -> T {
        guard let base = baseURL else { throw APIError.notConfigured }
        guard let url = URL(string: base.absoluteString + path) else { throw APIError.badURL }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = bodyData

        let (data, response) = try await session.data(for: urlRequest)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200..<300).contains(status) else {
            if let body = try? JSONDecoder().decode(APIErrorBody.self, from: data) {
                throw APIError.server(body.error)
            }
            throw APIError.http(status)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }
}
