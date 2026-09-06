param(
    [switch]$Reset
)

$ErrorActionPreference = "Stop"

$MysqlContainer = "muisnowdevs-mysql"
$RedisContainer = "muisnowdevs-redis"
$MinioContainer = "muisnowdevs-minio"

$MysqlPassword = "test_password"
$MysqlDatabase = "muisnowdevs"
$MysqlUser = "muisnowdevs"

$MinioUser = "minio"
$MinioPassword = "minio_password"

function Remove-Container
{
    param([string]$Name)

    $container = docker ps -aq --filter "name=^${Name}$"

    if ($container)
    {
        Write-Host "Removing $Name..."
        docker rm -f $Name | Out-Null
    }
}

if ($Reset)
{
    Remove-Container $MysqlContainer
    Remove-Container $RedisContainer
    Remove-Container $MinioContainer

    docker volume rm `
        muisnowdevs-mysql-data `
        muisnowdevs-redis-data `
        muisnowdevs-minio-data `
        2>$null
}

$existingMysql = docker ps -aq --filter "name=^${MysqlContainer}$"
if (-not $existingMysql)
{
    Write-Host "Creating MySQL..."

    docker run -d `
        --name $MysqlContainer `
        -p 3306:3306 `
        -e MYSQL_ROOT_PASSWORD=root `
        -e MYSQL_DATABASE=$MysqlDatabase `
        -e MYSQL_USER=$MysqlUser `
        -e MYSQL_PASSWORD=$MysqlPassword `
        -v muisnowdevs-mysql-data:/var/lib/mysql `
        mysql:latest
} else
{
    docker start $MysqlContainer | Out-Null
}

$existingRedis = docker ps -aq --filter "name=^${RedisContainer}$"
if (-not $existingRedis)
{
    Write-Host "Creating Redis..."

    docker run -d `
        --name $RedisContainer `
        -p 6379:6379 `
        -v muisnowdevs-redis-data:/data `
        redis:latest `
        redis-server --appendonly yes
} else
{
    docker start $RedisContainer | Out-Null
}

$existingMinio = docker ps -aq --filter "name=^${MinioContainer}$"
if (-not $existingMinio)
{
    Write-Host "Creating MinIO..."

    docker run -d `
        --name $MinioContainer `
        -p 9000:9000 `
        -p 9001:9001 `
        -e MINIO_ROOT_USER=$MinioUser `
        -e MINIO_ROOT_PASSWORD=$MinioPassword `
        -v muisnowdevs-minio-data:/data `
        minio/minio `
        server /data --console-address ":9001"
} else
{
    docker start $MinioContainer | Out-Null
}

Write-Host "Waiting for services..."

do
{
    Start-Sleep -Seconds 1
    docker exec $MysqlContainer mysqladmin ping -uroot -proot --silent 2>$null
} while ($LASTEXITCODE -ne 0)

do
{
    Start-Sleep -Seconds 1
    docker exec $RedisContainer redis-cli ping 2>$null | Out-Null
} while ($LASTEXITCODE -ne 0)

do
{
    Start-Sleep -Seconds 1
    docker exec $MinioContainer curl -fs http://localhost:9000/minio/health/live 2>$null | Out-Null
} while ($LASTEXITCODE -ne 0)

Write-Host "Creating MinIO buckets..."

docker run --rm `
    --network "container:$MinioContainer" `
    --entrypoint /bin/sh `
    minio/mc `
    -c @"
mc alias set local http://localhost:9000 '$MinioUser' '$MinioPassword'
mc mb --ignore-existing local/private
mc mb --ignore-existing local/public
"@

Write-Host ""
Write-Host "Dependencies are ready."
Write-Host ""
Write-Host "Environment:"
Write-Host @"

DB_HOST=127.0.0.1
DB_USERNAME=$MysqlUser
DB_PASSWORD=$MysqlPassword
DB_DATABASE=$MysqlDatabase

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0

S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY_ID=$MinioUser
S3_SECRET_ACCESS_KEY=$MinioPassword
S3_PRIVATE_BUCKET=private
S3_PUBLIC_BUCKET=public
"@

Write-Host ""
Write-Host "MinIO console:"
Write-Host "  http://localhost:9001"
Write-Host ""
Write-Host "Run migrations:"
Write-Host "  yarn migrations:apply"
