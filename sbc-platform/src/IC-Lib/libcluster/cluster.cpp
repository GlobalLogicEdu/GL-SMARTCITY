/*
 * =====================================================================================
 *
 *       Filename:  cluster.c
 *
 *    Description:  Instrument Cluster application
 *
 *        Version:  1.0
 *        Created:  20.03.17 19:45:45
 *       Revision:  02.2020
 *       Compiler:  gcc
 *
 *   Organization:  GlobalLogic
 *
 * =====================================================================================
 */

#include <cerrno>
#include <clocale>
#include <mutex>
#include <cstring>
#include <thread>

#include "MsgReceiver.hpp"
#include "ParkingController.hpp"
#include "TcpMsgSender.hpp"
#include "UdpMsgSender.hpp"
#include "cluster.h"
#include "json.hpp"
#include "logger.h"

using nlohmann::json;

#define SKIN_MAX_LENGTH 32

#define REGREQ_CMD_NAME "RegReq"
#define REGREQ_MAX_LENGTH (1000)

static io_service vwsReceiverService;
static std::shared_ptr<MsgReceiver> vwsReceiver = nullptr;
static std::shared_ptr<UdpMsgSender> vwsSender = nullptr;
static std::shared_ptr<UdpMsgSender> scsSender = nullptr;
static std::shared_ptr<UdpMsgSender> hubSender = nullptr;

struct cluster_ctx {
    struct cluster_config c = {};
    char skin[SKIN_MAX_LENGTH] = {};
};

static std::shared_ptr<cluster_ctx> ctx;

static struct cluster_state {
    double acceleration;
    double course;
    double latitude;
    double longitude;
    double speed;
    double rpm;
    int laneId;
    int gear;
    bool special;
} state;
static std::mutex state_mutex;

static void state_parse(const json& j)
{
    json state_node = j["state"];
    if (state_node.is_null())
        return;

    log_info("cluster: parse message");
    std::lock_guard<std::mutex> lock(state_mutex);

    try {
        state_node.at("acceleration").get_to(state.acceleration);
        state_node.at("course").get_to(state.course);
        state_node.at("latitude").get_to(state.latitude);
        state_node.at("longitude").get_to(state.longitude);
        state_node.at("speed").get_to(state.speed);
        state_node.at("rpm").get_to(state.rpm);
        state_node.at("special").get_to(state.special);
        state_node.at("gear").get_to(state.gear);
        state_node.at("laneid").get_to(state.laneId);
    } catch (std::exception& ex) {
        log_error("Problem with read package from eserver: %s", ex.what());
    }

    log_info(state_node.dump().c_str());
}

static notifier_cb event_update;

static int filter_pkt(const char* pkt)
{
    json value = json::parse(pkt);

    if (value.is_null()) {
        log_error("Unable to parse vws paket %s <<END", pkt);
        return -EINVAL;
    }

    std::strcpy(ctx->skin, value.at("skin").get<std::string>().c_str());
    state_parse(value);

    return 0;
}

void onVwsMessageReceived(const char* buffer)
{
    int err;

    if (!buffer) {
        return;
    }

    err = filter_pkt(buffer);

    if (!err) {

        scsSender->send(buffer);
        hubSender->send(buffer);

        if (event_update) {
            event_update();
        }
    }
    vwsReceiver->flushInternalBuffer();
}

int cluster_init(struct cluster_config* c)
{
    setlocale(LC_NUMERIC, "en_US.utf8");
    initLogger();

    int err;

    ctx = std::make_shared<cluster_ctx>();
    if (!ctx) {
        err = -ENOMEM;
        log_error("No memory");
        return err;
    }
    memcpy(&ctx->c, c, sizeof(struct cluster_config));

    /* Send register request to VWS */
    TcpMsgSender vwsRegisterSender(c->vws_address, c->vws_register_port);

    char data[REGREQ_MAX_LENGTH];
    std::snprintf(data, REGREQ_MAX_LENGTH, R"({ "cmd": "%s", "id": %d, "ip": "%s", "port": %d })",
        REGREQ_CMD_NAME, c->id, c->bind_address, c->port);

    vwsRegisterSender.send(data);

    vwsSender = std::make_shared<UdpMsgSender>(c->vws_address, c->vws_control_messages_port);
    if (nullptr == vwsSender) {
        err = -ENOMEM;
        log_error("vwsSender pointer is null.");
        return err;
    }
    scsSender = std::make_shared<UdpMsgSender>(c->scs_address, c->scs_port);
    if (nullptr == scsSender) {
        err = -ENOMEM;
        log_error("scsSender pointer is null.");
        return err;
    }
    hubSender = std::make_shared<UdpMsgSender>(c->hub_address, c->hub_port);
    if (nullptr == hubSender) {
        err = -ENOMEM;
        log_error("hubSender pointer is null.");
        return err;
    }

    return 0;
}

void subscribeVwsReceiver(void (*Callback)(const char*))
{
    try {
        vwsReceiver = std::make_shared<MsgReceiver>(vwsReceiverService, ctx->c.bind_address, ctx->c.port);
        vwsReceiver->setCallback(Callback);
        vwsReceiverService.run();
    }

    catch (std::exception& e) {
        log_error(e.what());
        throw;
    }
}

int cluster_run()
{
    std::thread([] {
        subscribeVwsReceiver(onVwsMessageReceived);
    }).detach();

    return 0;
}

int cluster_register_notifier(notifier_cb callback)
{
    event_update = callback;
    return 0;
}
